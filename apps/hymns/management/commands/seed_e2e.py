"""
Fixture de banco determinística e idempotente para a suíte E2E (Playwright).

**Por que este comando existe.** Duas tentativas de ligar um job de Playwright
no CI foram recusadas com a mesma justificativa — e ela é boa: sem seed
determinístico e sem usuário de teste, o job depende do banco que estiver por
perto, e job flaky é pior que job ausente. Este comando é a peça que faltava.

Uso::

    # dev (settings local, DEBUG=True)
    DJANGO_SETTINGS_MODULE=config.settings.local uv run python manage.py seed_e2e

    # limpando o que corridas anteriores da suíte deixaram
    ... manage.py seed_e2e --reset

**Gate de ambiente.** O comando cria usuários com senha conhecida. Isso é
aceitável em dev/CI e inaceitável em produção, então ele só roda com
``DEBUG=True`` ou sob um ``DJANGO_SETTINGS_MODULE`` terminado em ``.test``/
``.local``. Fora disso levanta ``CommandError`` antes de tocar no banco.

**Senhas.** Vêm do ambiente (``HINARIA_E2E_PASSWORD``), com default de dev. O
default só é alcançável porque o gate acima já eliminou produção — não existe
caminho em que ele vire credencial real.

**Idempotência.** Tudo é endereçado por chave natural (username, slug do
hinário, ``(hino, título do áudio)``) e só é escrito quando o valor atual
diverge do esperado. Rodar duas vezes seguidas não cria nada, não escreve nada
e — importante — não gera ``HymnRevision`` espúria, porque o signal editorial
de ``Hymn`` só dispara quando algum campo muda de verdade.

**Contrato com as specs.** As constantes públicas deste módulo (``SEED_BOOKS``,
``REVIEW_BOOK_SLUG``, ``PENDING_AUDIOS_EXPECTED``…) são o que
``tests/unit/test_seed_e2e.py`` trava e o que
``web/tests/e2e/_helpers/seed-fixture.ts`` espelha do lado do Playwright.
Mudou aqui, muda nos dois.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

from django.conf import settings
from django.contrib.auth.models import Group
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.hymns.models import Hymn, HymnAudio, HymnBook, HymnRevision
from apps.users.models import User

# --------------------------------------------------------------------------- #
# Contrato público (espelhado em web/tests/e2e/_helpers/seed-fixture.ts)
# --------------------------------------------------------------------------- #

#: Prefixo de tudo que o seed cria. É o que torna `--reset` cirúrgico e o que
#: permite às specs distinguir "meu dado" de "dado do banco de dev".
SEED_PREFIX = "E2E "

DEFAULT_EDITOR_USERNAME = "e2e-editor"
DEFAULT_VIEWER_USERNAME = "e2e-viewer"
DEFAULT_PASSWORD = "e2e-senha-dev"


def editor_username() -> str:
    """Usuário com papel editorial. Entra em `/editor/`."""
    return os.environ.get("HINARIA_E2E_EDITOR_USERNAME") or DEFAULT_EDITOR_USERNAME


def viewer_username() -> str:
    """Usuário comum. Existe para o guard ter quem negar."""
    return os.environ.get("HINARIA_E2E_VIEWER_USERNAME") or DEFAULT_VIEWER_USERNAME


def seed_password() -> str:
    """Senha dos dois usuários. Nunca alcançável em produção (ver gate)."""
    return os.environ.get("HINARIA_E2E_PASSWORD") or DEFAULT_PASSWORD


@dataclass(frozen=True)
class HymnSpec:
    number: int
    title: str
    text: str
    review_status: str
    style: str = ""
    repetitions: str = ""
    section: str = ""
    offered_to: str = ""
    #: Texto cru do OCR. Diferente de `text` ⇒ `HymnType.inlineDiff` e
    #: `ocrLineConfidences` saem preenchidos (o diff e o sparkline da tela 07).
    ocr_text: str = ""
    source: str = Hymn.Source.MANUAL
    ocr_avg_confidence: float | None = None


@dataclass(frozen=True)
class BookSpec:
    name: str
    slug: str
    owner_name: str
    priority: str
    is_published: bool
    description: str
    hymns: tuple[HymnSpec, ...] = field(default_factory=tuple)


_LETRA_REVISADA = "\n".join(
    [
        "Eu venho lá da mata",
        "Trazendo a minha luz",
        "Meu Pai me deu a força",
        "E a cruz de Jesus",
    ]
)

#: OCR "sujo" do mesmo hino: uma linha trocada (gera tokens `sub`), uma linha a
#: mais (gera `del` no diff) e acentuação perdida. É o material do diff inline.
_LETRA_OCR = "\n".join(
    [
        "Eu venho la da mata",
        "Trazendo a minha Iuz",
        "Meu Pai me deu a forca",
        "E a cruz de Jesus",
        "linha que o OCR inventou",
    ]
)


SEED_BOOKS: tuple[BookSpec, ...] = (
    BookSpec(
        name=f"{SEED_PREFIX}Fila Urgente",
        slug="e2e-fila-urgente",
        owner_name="Fixture E2E",
        priority=HymnBook.Priority.P1,
        is_published=True,
        description="Hinário P1 da fixture E2E: revisão pela metade, com pendentes.",
        hymns=(
            HymnSpec(
                number=1,
                title=f"{SEED_PREFIX}Primeiro Pendente",
                text=_LETRA_REVISADA,
                review_status=Hymn.ReviewStatus.NOT_REVIEWED,
                style="Valsa",
                repetitions="1-2,3-4",
                ocr_text=_LETRA_OCR,
                source=Hymn.Source.OCR,
                ocr_avg_confidence=82.5,
            ),
            HymnSpec(
                number=2,
                title=f"{SEED_PREFIX}Em Revisão",
                text="Estou em revisão\nE assim vou ficar",
                review_status=Hymn.ReviewStatus.IN_REVIEW,
                style="Marcha",
            ),
            HymnSpec(
                number=3,
                title=f"{SEED_PREFIX}Já Revisado",
                text="Este já passou\nPelos olhos do editor",
                review_status=Hymn.ReviewStatus.REVIEWED,
                style="Mazurca",
                repetitions="1-4",
            ),
            HymnSpec(
                number=4,
                title=f"{SEED_PREFIX}Segundo Pendente",
                text="Sou o próximo da fila\nQuando o primeiro avançar",
                review_status=Hymn.ReviewStatus.NOT_REVIEWED,
            ),
        ),
    ),
    BookSpec(
        name=f"{SEED_PREFIX}Coral Revisado",
        slug="e2e-coral-revisado",
        owner_name="Fixture E2E",
        priority=HymnBook.Priority.P2,
        is_published=True,
        description="Hinário P2 publicado, 2 de 3 revisados.",
        hymns=(
            HymnSpec(
                number=1,
                title=f"{SEED_PREFIX}Coral Um",
                text="Primeiro do coral\nJá revisado",
                review_status=Hymn.ReviewStatus.REVIEWED,
                style="Valsa",
                repetitions="1-2,3-4",
            ),
            HymnSpec(
                number=2,
                title=f"{SEED_PREFIX}Coral Dois",
                text="Segundo do coral\nTambém revisado",
                review_status=Hymn.ReviewStatus.REVIEWED,
                style="Marcha",
                repetitions="1-4",
            ),
            HymnSpec(
                number=3,
                title=f"{SEED_PREFIX}Coral Três",
                text="Terceiro do coral\nAinda esperando",
                review_status=Hymn.ReviewStatus.NOT_REVIEWED,
            ),
        ),
    ),
    BookSpec(
        name=f"{SEED_PREFIX}Rascunho Interno",
        slug="e2e-rascunho-interno",
        owner_name="Fixture E2E",
        priority=HymnBook.Priority.P2,
        is_published=False,
        description="Hinário P2 em rascunho: invisível ao público, visível ao editor.",
        hymns=(
            HymnSpec(
                number=1,
                title=f"{SEED_PREFIX}Rascunho Um",
                text="Nada revisado por aqui",
                review_status=Hymn.ReviewStatus.NOT_REVIEWED,
            ),
            HymnSpec(
                number=2,
                title=f"{SEED_PREFIX}Rascunho Dois",
                text="Nem aqui",
                review_status=Hymn.ReviewStatus.NOT_REVIEWED,
            ),
        ),
    ),
    BookSpec(
        name=f"{SEED_PREFIX}Selo Final",
        slug="e2e-selo-final",
        owner_name="Fixture E2E",
        priority=HymnBook.Priority.P3,
        is_published=True,
        description="Hinário P3 com tudo revisado — o caso do 'Tudo revisado ✓'.",
        hymns=(
            HymnSpec(
                number=1,
                title=f"{SEED_PREFIX}Selo Um",
                text="Fechado e conferido",
                review_status=Hymn.ReviewStatus.REVIEWED,
                style="Valsa",
                repetitions="1-4",
            ),
            HymnSpec(
                number=2,
                title=f"{SEED_PREFIX}Selo Dois",
                text="Fechado também",
                review_status=Hymn.ReviewStatus.REVIEWED,
                style="Marcha",
                repetitions="1-4",
            ),
        ),
    ),
)

#: Hinário usado pela jornada de revisão (tela 07). Tem pendente, próximo
#: pendente, OCR pra diff e histórico de revisões.
REVIEW_BOOK_SLUG = "e2e-fila-urgente"

#: Hinário com 100% de revisão — a tela de detalhe mostra "Tudo revisado ✓".
FULLY_REVIEWED_BOOK_SLUG = "e2e-selo-final"

#: Hinário em rascunho — o modal de publicação (5.D) mira nele.
DRAFT_BOOK_SLUG = "e2e-rascunho-interno"

#: Os dois P2, na ordem que `?sort=review:asc` produz. Como `priority` é sort
#: PRIMÁRIO quando `priority=all`, a reordenação só é observável dentro de uma
#: mesma prioridade — daí a dupla.
P2_SLUGS_BY_REVIEW_ASC = ("e2e-rascunho-interno", "e2e-coral-revisado")

#: Ordem default da fila (prioridade asc, depois nome asc), só entre semeados.
SEED_SLUGS_DEFAULT_ORDER = (
    "e2e-fila-urgente",
    "e2e-coral-revisado",
    "e2e-rascunho-interno",
    "e2e-selo-final",
)

#: Ordem da fila com `?sort=review:asc`, só entre semeados.
SEED_SLUGS_REVIEW_ASC_ORDER = (
    "e2e-fila-urgente",
    "e2e-rascunho-interno",
    "e2e-coral-revisado",
    "e2e-selo-final",
)


@dataclass(frozen=True)
class AudioSpec:
    book_slug: str
    hymn_number: int
    title: str
    credits: str
    is_approved: bool
    #: `True` ⇒ enviado pelo usuário comum (é o caso realista da fila de
    #: pendentes: alguém de fora manda, o editor aprova).
    uploaded_by_viewer: bool = True


SEED_AUDIOS: tuple[AudioSpec, ...] = (
    AudioSpec(
        book_slug=REVIEW_BOOK_SLUG,
        hymn_number=1,
        title=f"{SEED_PREFIX}Gravação do Primeiro Pendente",
        credits="Gravação sintética da fixture E2E",
        is_approved=False,
    ),
    AudioSpec(
        book_slug=REVIEW_BOOK_SLUG,
        hymn_number=3,
        title=f"{SEED_PREFIX}Gravação Aguardando Aprovação",
        credits="Enviada pelo usuário comum da fixture",
        is_approved=False,
    ),
    AudioSpec(
        book_slug="e2e-coral-revisado",
        hymn_number=1,
        title=f"{SEED_PREFIX}Gravação Aprovada",
        credits="Já aprovada pelo editor da fixture",
        is_approved=True,
        uploaded_by_viewer=False,
    ),
)

#: Quantos áudios do seed ficam aguardando aprovação. A spec de dashboard
#: compara o badge com a fila; esta constante é o piso que ela exige.
PENDING_AUDIOS_EXPECTED = len([a for a in SEED_AUDIOS if not a.is_approved])

#: Resumo de revisão que o seed grava explicitamente no hino da tela 07 — o
#: drawer de histórico precisa de pelo menos um item com diff de campo.
REVISION_SUMMARY = f"{SEED_PREFIX}Ajuste editorial da fixture"

#: Waveform sintética: 120 floats em 0..1, o mesmo tamanho que o backfill
#: produz. Semear pronto evita que o signal acorde uma thread com ffmpeg.
_WAVEFORM_PEAKS = [round(0.2 + 0.7 * abs(((i % 24) / 24) - 0.5) * 2, 3) for i in range(120)]

#: Bytes de um "arquivo" de áudio. Não é MP3 tocável de verdade — a fila de
#: pendentes usa `preload="none"`, então o browser nunca busca o conteúdo, e
#: `waveform_peaks` já vem pronto. Serve pra `FileField` ter um arquivo.
_AUDIO_BYTES = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 512


# --------------------------------------------------------------------------- #
# Gate de ambiente
# --------------------------------------------------------------------------- #

_ALLOWED_SETTINGS_SUFFIXES = (".test", ".local")

_GATE_ERROR = (
    "seed_e2e cria usuários com senha conhecida e só roda em ambiente de "
    "desenvolvimento ou teste. Rode com DEBUG=True ou com "
    "DJANGO_SETTINGS_MODULE terminado em .test/.local. "
    "Em produção o comando é recusado de propósito."
)


def environment_allows_seed() -> bool:
    """`True` quando é seguro criar usuários de teste neste ambiente."""
    if getattr(settings, "DEBUG", False):
        return True
    module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
    return module.endswith(_ALLOWED_SETTINGS_SUFFIXES)


# --------------------------------------------------------------------------- #
# Comando
# --------------------------------------------------------------------------- #


class Command(BaseCommand):
    help = "Semeia o banco com o estado determinístico que a suíte E2E espera."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help=(
                "Apaga tudo que carrega o prefixo do seed antes de recriar — "
                "inclusive hinários que a jornada de CRUD deixou pra trás."
            ),
        )

    def handle(self, *args, **options):
        if not environment_allows_seed():
            raise CommandError(_GATE_ERROR)

        with transaction.atomic():
            if options.get("reset"):
                self._reset()

            editor = self._ensure_user(editor_username(), is_editor=True)
            viewer = self._ensure_user(viewer_username(), is_editor=False)
            books = {spec.slug: self._ensure_book(spec, editor) for spec in SEED_BOOKS}
            self._ensure_audios(books, editor, viewer)
            self._ensure_revisions(books, editor)

        self._report(options.get("verbosity", 1))

    # -- reset -------------------------------------------------------------- #

    def _reset(self) -> None:
        """Remove o que o seed (e a suíte) criaram, e só isso.

        O filtro é o prefixo: hinários de dev com outro nome ficam intactos.
        Os usuários não são apagados — deletá-los levaria junto `HymnRevision`
        alheia por FK e, pior, o `sessionid` de quem estivesse com a suíte
        aberta. Realinhar a senha (em `_ensure_user`) resolve o mesmo problema
        sem colateral.
        """
        HymnAudio.objects.filter(title__startswith=SEED_PREFIX).delete()
        HymnBook.objects.filter(name__startswith=SEED_PREFIX).delete()

    # -- usuários ----------------------------------------------------------- #

    def _ensure_user(self, username: str, *, is_editor: bool) -> User:
        user, _created = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@example.test", "is_active": True},
        )

        # A senha é realinhada em toda corrida: o banco de dev pode ter o
        # usuário de uma corrida anterior com outra `HINARIA_E2E_PASSWORD`, e
        # uma fixture de login que falha por senha velha é o pior tipo de
        # flakiness — some sem deixar rastro no relatório.
        password = seed_password()
        if not user.check_password(password):
            user.set_password(password)
            user.save(update_fields=["password"])

        # O papel editorial vem do grupo `editor` (criado pela migration
        # 0008), que é a MESMA fonte de `UserType.isEditor` — semear
        # `is_superuser` faria o guard passar por superpoder e a spec deixaria
        # de exercitar a regra real.
        group = Group.objects.filter(name="editor").first()
        if group is not None:
            in_group = user.groups.filter(pk=group.pk).exists()
            if is_editor and not in_group:
                user.groups.add(group)
            elif not is_editor and in_group:
                user.groups.remove(group)

        if user.is_superuser or user.is_staff:
            user.is_superuser = False
            user.is_staff = False
            user.save(update_fields=["is_superuser", "is_staff"])

        # `has_perm` cacheia por instância; a suíte lê o papel logo em seguida.
        return User.objects.get(pk=user.pk)

    # -- hinários e hinos --------------------------------------------------- #

    def _ensure_book(self, spec: BookSpec, editor: User) -> HymnBook:
        book, created = HymnBook.objects.get_or_create(
            slug=spec.slug,
            defaults={
                "name": spec.name,
                "owner_name": spec.owner_name,
                "priority": spec.priority,
                "is_published": spec.is_published,
                "description": spec.description,
            },
        )
        desejado = {
            "name": spec.name,
            "owner_name": spec.owner_name,
            "priority": spec.priority,
            "is_published": spec.is_published,
            "description": spec.description,
        }
        if not created:
            self._apply(book, desejado)

        if spec.is_published and book.published_at is None:
            book.published_at = timezone.now()
            book.published_by = editor
            book.save(update_fields=["published_at", "published_by"])
        elif not spec.is_published and book.published_at is not None:
            book.published_at = None
            book.published_by = None
            book.save(update_fields=["published_at", "published_by"])

        semeados = {hymn_spec.number for hymn_spec in spec.hymns}
        for hymn_spec in spec.hymns:
            self._ensure_hymn(book, hymn_spec, editor)
        # Hino que a jornada de CRUD adicionou some no próximo seed — senão a
        # contagem de "X de Y revisados" muda entre corridas.
        book.hymns.exclude(number__in=semeados).delete()
        return book

    def _ensure_hymn(self, book: HymnBook, spec: HymnSpec, editor: User) -> Hymn:
        revisado = spec.review_status == Hymn.ReviewStatus.REVIEWED
        desejado = {
            "title": spec.title,
            "text": spec.text,
            "review_status": spec.review_status,
            "style": spec.style,
            "repetitions": spec.repetitions,
            "section": spec.section,
            "offered_to": spec.offered_to,
            "ocr_text": spec.ocr_text,
            "ocr_avg_confidence": spec.ocr_avg_confidence,
            "source": spec.source,
            "last_reviewed_by": editor if revisado else None,
        }

        hymn, created = Hymn.objects.get_or_create(
            hymn_book=book,
            number=spec.number,
            defaults=desejado,
        )
        if created:
            if revisado:
                Hymn.objects.filter(pk=hymn.pk).update(last_reviewed_at=timezone.now())
            return hymn

        self._apply(hymn, desejado)
        alvo = timezone.now() if revisado else None
        if (hymn.last_reviewed_at is None) != (alvo is None):
            Hymn.objects.filter(pk=hymn.pk).update(last_reviewed_at=alvo)
        return hymn

    # -- áudios ------------------------------------------------------------- #

    def _ensure_audios(self, books: dict[str, HymnBook], editor: User, viewer: User) -> None:
        for spec in SEED_AUDIOS:
            book = books[spec.book_slug]
            hymn = book.hymns.get(number=spec.hymn_number)
            uploader = viewer if spec.uploaded_by_viewer else editor

            audio, created = HymnAudio.objects.get_or_create(
                hymn=hymn,
                title=spec.title,
                defaults={
                    "credits": spec.credits,
                    "format": "mp3",
                    "duration": 137,
                    "file_size": len(_AUDIO_BYTES),
                    "uploaded_by": uploader,
                    "is_approved": spec.is_approved,
                    "waveform_peaks": list(_WAVEFORM_PEAKS),
                },
            )
            if created:
                # Só grava o arquivo na criação: o storage renomeia colisões
                # (`arquivo_A1b2c3.mp3`), então reescrever a cada corrida
                # encheria o MEDIA_ROOT de lixo.
                audio.audio_file.save(
                    f"{spec.book_slug}-{spec.hymn_number}-e2e.mp3",
                    ContentFile(_AUDIO_BYTES),
                    save=True,
                )
            else:
                self._apply(
                    audio,
                    {
                        "credits": spec.credits,
                        "uploaded_by": uploader,
                        # Devolve ao estado semeado o que a jornada de CRUD
                        # aprovou/rejeitou na corrida anterior.
                        "is_approved": spec.is_approved,
                        "is_match": True if spec.is_approved else None,
                        "waveform_peaks": list(_WAVEFORM_PEAKS),
                    },
                )

            if spec.is_approved and audio.reviewed_by_id is None:
                HymnAudio.objects.filter(pk=audio.pk).update(
                    reviewed_by=editor, reviewed_at=timezone.now(), quality_rating=4
                )

    # -- histórico de revisões --------------------------------------------- #

    def _ensure_revisions(self, books: dict[str, HymnBook], editor: User) -> None:
        """Garante trilha de auditoria no hino da tela 07.

        Dois efeitos de uma vez:

        1. O drawer "Histórico" abre com conteúdo (o hino já nasce com uma
           revisão automática "Criado via OCR"; esta é a segunda, com
           `field_diff` de verdade).
        2. `editorDashboardStats.resumeHymn` passa a existir — ele é a última
           `HymnRevision` do próprio editor sobre um hino ainda não revisado,
           que é exatamente este.
        """
        hymn = books[REVIEW_BOOK_SLUG].hymns.get(number=1)
        HymnRevision.objects.get_or_create(
            hymn=hymn,
            change_summary=REVISION_SUMMARY,
            defaults={
                "revised_by": editor,
                "previous_status": Hymn.ReviewStatus.NOT_REVIEWED,
                "new_status": Hymn.ReviewStatus.NOT_REVIEWED,
                "field_diff": {
                    "title": {"old": "Titulo cru do OCR", "new": hymn.title},
                    "style": {"old": "", "new": hymn.style},
                },
            },
        )

    # -- utilitários -------------------------------------------------------- #

    @staticmethod
    def _apply(instance, desejado: dict) -> bool:
        """Salva só o que divergiu. Devolve `True` se escreveu.

        Escrever sem necessidade não é só desperdício: `Hymn.save()` dispara o
        signal que grava `HymnRevision` e o que incrementa
        `HymnBook.sync_version` — o contador que diz ao cliente offline que o
        cache dele expirou. Um seed que re-salva tudo a cada corrida invalidaria
        o cache de todo mundo sem nada ter mudado.

        Campo de relação é comparado pela CHAVE (`campo_id`), nunca pelo
        objeto: `UUID != User` é sempre verdade, e a comparação ingênua faria
        toda linha com FK ser reescrita em toda corrida.
        """
        mudou = []
        for campo, valor in desejado.items():
            if instance._meta.get_field(campo).is_relation:
                atual = getattr(instance, f"{campo}_id")
                alvo = getattr(valor, "pk", None)
            else:
                atual = getattr(instance, campo)
                alvo = valor
            if atual != alvo:
                mudou.append(campo)
        if not mudou:
            return False
        for campo in mudou:
            setattr(instance, campo, desejado[campo])
        instance.save(update_fields=mudou)
        return True

    def _report(self, verbosity: int) -> None:
        if not verbosity:
            return
        pendentes = HymnAudio.objects.filter(title__startswith=SEED_PREFIX, is_approved=False).count()
        self.stdout.write(self.style.SUCCESS("seed_e2e pronto."))
        self.stdout.write(f"  editor:   {editor_username()}")
        self.stdout.write(f"  comum:    {viewer_username()}")
        self.stdout.write(f"  hinários: {len(SEED_BOOKS)} (prefixo {SEED_PREFIX!r})")
        self.stdout.write(f"  hinos:    {sum(len(b.hymns) for b in SEED_BOOKS)}")
        self.stdout.write(f"  áudios:   {len(SEED_AUDIOS)} ({pendentes} pendentes)")
