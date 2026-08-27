"""
Frente B · varredura dos gates de query — o contrato da mensagem de auth.

A mensagem de "precisa estar logado" é um contrato ENTRE CAMADAS, não texto
solto: o shell classifica o erro por substring pra decidir o redirect pro login
(`_isEditorAccessError` em `web/src/routes/editor/+layout.ts`, reusado por
`/notificacoes`, `/perfil/[u]/seguidores/` e `/seguindo/`). Foi exatamente esse
acoplamento invisível que produziu o bug da Frente B: a rota `/notificacoes`
procurava `authenticat` numa mensagem em português e nunca redirecionava.

`apps/api/errors.py` já declara o dono da regra — `AUTHENTICATION_REQUIRED_PREFIX`
+ `authentication_required(action)` — e o próprio docstring de lá manda toda
mensagem nova passar por ali. `Query.notifications` era a única que ainda
carregava a string crua no corpo do resolver, ou seja: mudar o prefixo em
`errors.py` deixaria essa mensagem para trás sem nenhum teste reclamar, e o
redirect voltaria a sumir.

Estes dois testes fecham a porta pelos dois lados: um lê a fonte (nenhuma
string crua fora de `errors.py`) e o outro lê o wire (a mensagem que chega ao
cliente é exatamente a que `authentication_required` produz).
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from apps.api.errors import AUTHENTICATION_REQUIRED_PREFIX, authentication_required

from ._helpers import gql

API_DIR = Path(__file__).resolve().parents[3] / "apps" / "api"

# `errors.py` é o dono da string — é lá que ela nasce.
MODULOS_AUDITADOS = sorted(p for p in API_DIR.glob("*.py") if p.name != "errors.py")


def _docstrings(arvore: ast.Module) -> set[int]:
    """Linhas ocupadas por docstring — documentação não é mensagem."""
    linhas: set[int] = set()
    for no in ast.walk(arvore):
        if not isinstance(no, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        corpo = getattr(no, "body", None)
        if not corpo:
            continue
        primeiro = corpo[0]
        if isinstance(primeiro, ast.Expr) and isinstance(primeiro.value, ast.Constant):
            if isinstance(primeiro.value.value, str):
                linhas.update(range(primeiro.lineno, (primeiro.end_lineno or primeiro.lineno) + 1))
    return linhas


def _strings_de_codigo(modulo: Path):
    """Literais de string que viram VALOR, com a linha de cada um.

    Lê a sintaxe em vez de varrer linha a linha, porque a versão anterior
    varria texto cru e acusava `apps/api/types.py:76` — uma **docstring** que
    explica o comportamento do gate pra quem for ler o código. Contorcer a
    documentação pra calar o guard seria o incentivo errado: ensina a não
    documentar. Comentário `#` também não é mensagem e some junto, porque o
    `ast` nem o enxerga.
    """
    arvore = ast.parse(modulo.read_text(encoding="utf-8"))
    ignoradas = _docstrings(arvore)
    for no in ast.walk(arvore):
        if isinstance(no, ast.Constant) and isinstance(no.value, str):
            if no.lineno not in ignoradas:
                yield no.lineno, no.value


@pytest.mark.parametrize("modulo", MODULOS_AUDITADOS, ids=lambda p: p.name)
def test_nenhum_resolver_repete_a_string_de_autenticacao(modulo):
    """A mensagem de auth só pode sair de `errors.authentication_required`.

    Uma cópia crua no resolver silencia o acoplamento com o classificador do
    shell: o prefixo muda em `errors.py`, a cópia fica, e o redirect pro login
    para de acontecer sem nenhum teste ficar vermelho.
    """
    for lineno, trecho in _strings_de_codigo(modulo):
        if AUTHENTICATION_REQUIRED_PREFIX in trecho:
            pytest.fail(
                f"{modulo.name}:{lineno} escreve '{AUTHENTICATION_REQUIRED_PREFIX}' na mão. "
                f"Use `errors.authentication_required('<ação no infinitivo>')` — é o que trava o "
                f"prefixo PT-BR que o shell classifica pra redirecionar pro login. "
                f"Trecho: {trecho.strip()[:120]}"
            )


@pytest.mark.django_db
def test_notifications_recusa_anonimo_com_a_mensagem_canonica(client):
    """O wire, não só a fonte: a mensagem que o anônimo recebe é a canônica.

    O texto exato é o que `web/src/routes/notificacoes/+page.ts` classifica.
    Cravar a igualdade aqui (e não um `in`) faz esta suíte falhar se alguém
    reescrever a mensagem sem olhar o shell.
    """
    data = gql(client, "{ notifications { id } }")
    assert "errors" in data, data
    assert data["errors"][0]["message"] == authentication_required("listar notificações")
    assert data["data"] is None
