# Plano: Remover feature de comentários em hinos

## Contexto

A plataforma `hymns-plat` tem hoje uma feature de comentários em hinos
(modelo `Comment`, formulário, views, templates, admin, notificações).
Decidimos removê-la — não há sinalização de uso, e ela acrescenta
superfície de moderação (`is_flagged`, `flag_comment`, admin
moderation) sem retorno proporcional.

Objetivo: extirpar a feature do código, do banco e dos testes,
mantendo intactas as outras features sociais (favoritos, follow,
áudio, notificações).

## Escopo

**Removido:** modelo `Comment` + tabela, form, 3 views, 3 URLs, seção
e botão no template do hino, página `add_comment.html`, registro no
admin, testes de comentário, suporte do tipo `TYPE_COMMENT` em
`Notification`, badge "Comentário" em `notifications.html`, asserção
sobre o link "Comentar" no E2E social.

**Não removido:** `Favorite`, `UserFollow`, `HymnAudio`, `Notification`
em si (perde apenas o tipo "comment"), o app `apps/hymns` e seus
demais modelos.

## Migrations

A migration `apps/hymns/migrations/0003_comment_favorite_hymnaudio.py`
é uma bundle que cria três modelos. Ela permanece como histórico de
schema. Adicionamos:

1. `apps/hymns/migrations/0007_drop_comment.py` — `RemoveModel(Comment)`.
2. `apps/users/migrations/0003_drop_type_comment.py` — `RunPython` que
   deleta `Notification` com tipo `comment`, seguido de `AlterField`
   removendo `TYPE_COMMENT` das choices e mudando o default para
   `TYPE_FAVORITE`. Depende de
   `apps.hymns.0007_drop_comment` para garantir que comments somem
   antes de mexer no enum.

## Verificação

1. `poetry run python manage.py makemigrations --check --dry-run`
2. `poetry run python manage.py migrate && poetry run pytest -x`
3. `poetry run black --check . && poetry run isort --check-only . && poetry run ruff check .`
4. `grep -rn "Comment\|TYPE_COMMENT\|add_comment\|delete_comment\|flag_comment" apps/ templates/ tests/ | grep -v "{% comment %}\|{% endcomment %}\|migrations/0003"` → vazio
5. Smoke test no browser: hymn detail sem botão e sem seção; admin sem entrada; `/notificacoes/` ok.
