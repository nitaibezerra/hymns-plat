"""
Sistema de desambiguação de hinários.
Detecta possíveis duplicatas usando fuzzy matching e comparação de hinos.
"""

from difflib import SequenceMatcher
from typing import Dict, List, Tuple

from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Func, Value

from .models import HymnBook


class _Unaccent(Func):
    """Chama função SQL `unaccent(text)` (extension unaccent)."""

    function = "unaccent"


def calculate_string_similarity(str1: str, str2: str) -> float:
    """
    Calcula similaridade entre duas strings usando SequenceMatcher.

    Args:
        str1: Primeira string
        str2: Segunda string

    Returns:
        float: Score de similaridade entre 0.0 e 1.0
    """
    if not str1 or not str2:
        return 0.0
    return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()


def normalize_hymnbook_name(name: str) -> str:
    """
    Normaliza nome de hinário para comparação.

    Args:
        name: Nome do hinário

    Returns:
        str: Nome normalizado (lowercase, sem espaços extras)
    """
    if not name:
        return ""
    return " ".join(name.lower().split())


def find_exact_match(name: str) -> HymnBook | None:
    """
    Busca match exato de nome de hinário (case-insensitive).

    Args:
        name: Nome do hinário a buscar

    Returns:
        HymnBook | None: Hinário encontrado ou None
    """
    normalized = normalize_hymnbook_name(name)

    for hymnbook in HymnBook.objects.all():
        if normalize_hymnbook_name(hymnbook.name) == normalized:
            return hymnbook

    return None


def find_similar_hymnbooks(name: str, threshold: float = 0.7, limit: int = 5) -> List[Tuple[HymnBook, float]]:
    """
    Busca hinários similares usando fuzzy matching no nome.

    Args:
        name: Nome do hinário a comparar
        threshold: Threshold mínimo de similaridade (0.0 a 1.0)
        limit: Máximo de resultados a retornar

    Returns:
        List[Tuple[HymnBook, float]]: Lista de (hinário, score) ordenada por score
    """
    normalized_name = normalize_hymnbook_name(name)
    results = []

    for hymnbook in HymnBook.objects.all():
        similarity = calculate_string_similarity(normalized_name, normalize_hymnbook_name(hymnbook.name))

        if similarity >= threshold:
            results.append((hymnbook, similarity))

    # Ordena por score decrescente
    results.sort(key=lambda x: x[1], reverse=True)

    return results[:limit]


def compare_hymn_texts(hymns1: List[Dict], hymns2: List[Dict], sample_size: int = 5) -> float:
    """
    Compara textos de hinos entre dois hinários.

    Args:
        hymns1: Lista de dicionários com keys 'number', 'title', 'text'
        hymns2: Lista de dicionários com keys 'number', 'title', 'text'
        sample_size: Número de hinos a comparar (primeiros N)

    Returns:
        float: Score médio de similaridade entre 0.0 e 1.0
    """
    if not hymns1 or not hymns2:
        return 0.0

    # Ordena por número
    hymns1_sorted = sorted(hymns1, key=lambda x: x.get("number", 0))[:sample_size]
    hymns2_sorted = sorted(hymns2, key=lambda x: x.get("number", 0))[:sample_size]

    # Se tamanhos diferentes, ajusta para o menor
    max_compare = min(len(hymns1_sorted), len(hymns2_sorted))
    if max_compare == 0:
        return 0.0

    total_similarity = 0.0

    for i in range(max_compare):
        h1 = hymns1_sorted[i]
        h2 = hymns2_sorted[i]

        # Compara título
        title_similarity = calculate_string_similarity(
            h1.get("title", ""),
            h2.get("title", ""),
        )

        # Compara texto (mais peso)
        text_similarity = calculate_string_similarity(
            h1.get("text", ""),
            h2.get("text", ""),
        )

        # Média ponderada: 30% título, 70% texto
        hymn_similarity = (title_similarity * 0.3) + (text_similarity * 0.7)
        total_similarity += hymn_similarity

    return total_similarity / max_compare


def find_duplicates_with_content(
    name: str,
    hymns: List[Dict],
    name_threshold: float = 0.7,
    content_threshold: float = 0.8,
) -> Dict:
    """
    Busca duplicatas combinando similaridade de nome e conteúdo.

    Args:
        name: Nome do hinário proposto
        hymns: Lista de hinos do hinário proposto
        name_threshold: Threshold de similaridade de nome (0.0 a 1.0)
        content_threshold: Threshold de similaridade de conteúdo (0.0 a 1.0)

    Returns:
        Dict com:
            - exact_match: HymnBook | None - Match exato de nome
            - high_confidence: List[Tuple[HymnBook, float, float]] - Duplicatas prováveis
              (hinário, score_nome, score_conteudo)
            - medium_confidence: List[Tuple[HymnBook, float, float]] - Possivelmente similares
            - low_confidence: List[Tuple[HymnBook, float, float]] - Levemente similares
    """
    result = {
        "exact_match": None,
        "high_confidence": [],  # Nome + conteúdo similar
        "medium_confidence": [],  # Nome similar OU conteúdo similar
        "low_confidence": [],  # Levemente similar
    }

    # 1. Busca match exato
    exact = find_exact_match(name)
    if exact:
        result["exact_match"] = exact
        return result

    # 2. Busca hinários similares por nome
    similar_by_name = find_similar_hymnbooks(name, threshold=name_threshold, limit=10)

    # 3. Para cada hinário similar, compara conteúdo se houver dados de hinos
    for hymnbook, name_score in similar_by_name:
        content_score = 0.0

        if hymns:
            # Pega primeiros 5 hinos do hinário existente
            existing_hymns = []
            for hymn in hymnbook.hymns.all().order_by("number")[:5]:
                existing_hymns.append(
                    {
                        "number": hymn.number,
                        "title": hymn.title,
                        "text": hymn.text,
                    }
                )

            if existing_hymns:
                content_score = compare_hymn_texts(hymns, existing_hymns, sample_size=5)

        # Classifica confiança
        if name_score >= 0.9 and content_score >= content_threshold:
            # Alta confiança: nome muito similar + conteúdo similar
            result["high_confidence"].append((hymnbook, name_score, content_score))
        elif name_score >= name_threshold and content_score >= content_threshold:
            # Média confiança: nome e conteúdo acima do threshold
            result["medium_confidence"].append((hymnbook, name_score, content_score))
        elif name_score >= name_threshold or content_score >= 0.6:
            # Baixa confiança: apenas nome similar ou conteúdo levemente similar
            result["low_confidence"].append((hymnbook, name_score, content_score))

    return result


def suggest_similar_via_trigram(query: str, limit: int = 5, threshold: float = 0.3) -> List[HymnBook]:
    """
    Busca hinários com nome similar ao query usando `pg_trgm` + `unaccent`.

    Substitui a antiga `suggest_similar_via_typesense`. Tolerante a typos e
    variações de acentuação (ex.: "oracao" encontra "Oração").

    Args:
        query: Termo de busca
        limit: Máximo de resultados
        threshold: Similarity mínima (0.0-1.0). Default 0.3 equilibra typos
            legítimos vs falsos positivos.

    Returns:
        Lista de HymnBook ordenada por similaridade decrescente.
    """
    if not query or not query.strip():
        return []

    return list(
        HymnBook.objects.annotate(
            sim=TrigramSimilarity(_Unaccent("name"), _Unaccent(Value(query))),
        )
        .filter(sim__gt=threshold)
        .order_by("-sim")[:limit]
    )
