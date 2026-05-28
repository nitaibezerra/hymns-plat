"""
Forms for hymns app.
"""

from django import forms

from .models import Hymn, HymnBook, HymnBookVersion


class HymnBookForm(forms.ModelForm):
    """Form para criar/editar HymnBook via web."""

    class Meta:
        model = HymnBook
        fields = ["name", "intro_name", "owner_name", "description", "cover_image"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: O Cruzeiro"}),
            "intro_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Nome curto (opcional)"}),
            "owner_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: Mestre Irineu"}),
            "description": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "placeholder": "Descrição do hinário (opcional)",
                    "rows": 4,
                }
            ),
            "cover_image": forms.FileInput(attrs={"class": "form-control", "accept": "image/*"}),
        }
        labels = {
            "name": "Nome do Hinário",
            "intro_name": "Nome Curto",
            "owner_name": "Dono / Autor",
            "description": "Descrição",
            "cover_image": "Imagem de Capa",
        }


class HymnForm(forms.ModelForm):
    """Form para criar/editar Hymn via web. Requer hymn_book no __init__."""

    class Meta:
        model = Hymn
        fields = [
            "number",
            "title",
            "text",
            "received_at",
            "offered_to",
            "section",
            "style",
            "extra_instructions",
            "repetitions",
        ]
        widgets = {
            "number": forms.NumberInput(attrs={"class": "form-control", "min": 1}),
            "title": forms.TextInput(attrs={"class": "form-control"}),
            "text": forms.Textarea(attrs={"class": "form-control", "rows": 12, "placeholder": "Letra do hino"}),
            "received_at": forms.DateInput(attrs={"type": "date", "class": "form-control"}),
            "offered_to": forms.TextInput(attrs={"class": "form-control"}),
            "section": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: Offered to Sônia Palhares"}),
            "style": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: Valsa, Marcha"}),
            "extra_instructions": forms.Textarea(attrs={"class": "form-control", "rows": 2}),
            "repetitions": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: 1-4, 5-8"}),
        }
        labels = {
            "number": "Número",
            "title": "Título",
            "text": "Letra",
            "received_at": "Recebido em",
            "offered_to": "Oferecido para",
            "section": "Seção",
            "style": "Estilo",
            "extra_instructions": "Instruções",
            "repetitions": "Repetições",
        }

    def __init__(self, *args, hymn_book=None, **kwargs):
        super().__init__(*args, **kwargs)
        if hymn_book is None and self.instance.pk:
            hymn_book = self.instance.hymn_book
        self.hymn_book = hymn_book

    def clean_number(self):
        number = self.cleaned_data.get("number")
        if number is None or self.hymn_book is None:
            return number
        qs = Hymn.objects.filter(hymn_book=self.hymn_book, number=number)
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise forms.ValidationError(f"Já existe um hino com o número {number} neste hinário.")
        return number


class HymnBookEditorialForm(forms.ModelForm):
    """Painel staff de curadoria editorial no `hymnbook_detail`.

    Edita só `priority` (P1/P2/P3) e `is_featured`. Outros campos do hinário
    seguem editáveis pelo `HymnBookForm` regular ou pelo Django admin.
    """

    class Meta:
        model = HymnBook
        fields = ["priority", "is_featured"]
        widgets = {
            "priority": forms.RadioSelect(),
            "is_featured": forms.CheckboxInput(),
        }
        labels = {
            "priority": "Prioridade de revisão",
            "is_featured": "Exibir em destaque na home",
        }


class QuickReviewForm(forms.ModelForm):
    """Form da tela 07c · Revisão ágil — só `style` e `repetitions`.

    Restringe `Meta.fields` aos dois campos editáveis nesta tela; outros
    campos (`text`, `review_status`, etc.) ficam imutáveis mesmo se vierem
    no POST. Isso é defesa-em-profundidade contra um payload inflado.
    """

    class Meta:
        model = Hymn
        fields = ["style", "repetitions"]
        widgets = {
            "style": forms.TextInput(attrs={"class": "form-control"}),
            "repetitions": forms.TextInput(attrs={"class": "form-control"}),
        }


class HymnBookPdfUploadForm(forms.Form):
    """
    Upload a hymnbook by sending a PDF; the server runs hymn-ocr to extract
    the hymns. Name and owner are required because OCR can't infer them.
    """

    pdf_file = forms.FileField(
        label="Arquivo PDF",
        help_text="Envie um PDF gerado pelo hymn_pdf_generator. A extração via OCR pode levar alguns minutos.",
        widget=forms.FileInput(attrs={"accept": ".pdf", "class": "form-control"}),
    )

    name = forms.CharField(
        label="Nome do Hinário",
        max_length=255,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: O Justiceiro"}),
    )

    owner_name = forms.CharField(
        label="Dono do Hinário",
        max_length=255,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Ex: Padrinho Sebastião"}),
    )

    cover_image = forms.ImageField(
        label="Imagem de Capa (opcional)",
        required=False,
        help_text="JPG, PNG ou GIF. Tamanho recomendado: 600x800px",
        widget=forms.FileInput(attrs={"accept": "image/*", "class": "form-control"}),
    )

    def clean_pdf_file(self):
        pdf_file = self.cleaned_data.get("pdf_file")
        if pdf_file:
            if not pdf_file.name.lower().endswith(".pdf"):
                raise forms.ValidationError("O arquivo deve ter extensão .pdf")
            if pdf_file.size > 50 * 1024 * 1024:
                raise forms.ValidationError("O arquivo não pode ser maior que 50MB")
        return pdf_file


class HymnBookVersionForm(forms.ModelForm):
    """
    Form for creating a new version of an existing hymnbook.
    """

    class Meta:
        model = HymnBookVersion
        fields = ["version_name", "description", "pdf_file", "yaml_file"]
        widgets = {
            "version_name": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Ex: Edição 2020, Versão Revisada",
                }
            ),
            "description": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "placeholder": "Descreva as diferenças desta versão...",
                    "rows": 4,
                }
            ),
            "pdf_file": forms.FileInput(
                attrs={
                    "accept": ".pdf",
                    "class": "form-control",
                }
            ),
            "yaml_file": forms.FileInput(
                attrs={
                    "accept": ".yaml,.yml",
                    "class": "form-control",
                }
            ),
        }
        labels = {
            "version_name": "Nome da Versão",
            "description": "Descrição",
            "pdf_file": "Arquivo PDF (opcional)",
            "yaml_file": "Arquivo YAML (opcional)",
        }
        help_texts = {
            "version_name": "Identifique esta versão do hinário",
            "description": "Explique o que diferencia esta versão das outras",
        }


class DisambiguationChoiceForm(forms.Form):
    """
    Form for user to choose what to do when duplicates are detected.
    """

    CHOICE_CREATE_NEW = "create_new"
    CHOICE_ADD_VERSION = "add_version"
    CHOICE_CANCEL = "cancel"

    CHOICES = [
        (CHOICE_CREATE_NEW, "Criar novo hinário (são hinários diferentes)"),
        (CHOICE_ADD_VERSION, "Adicionar como nova versão de um hinário existente"),
        (CHOICE_CANCEL, "Cancelar upload"),
    ]

    choice = forms.ChoiceField(
        label="O que deseja fazer?",
        choices=CHOICES,
        widget=forms.RadioSelect(attrs={"class": "form-check-input"}),
        initial=CHOICE_CREATE_NEW,
    )

    selected_hymnbook = forms.UUIDField(
        label="Hinário selecionado",
        required=False,
        widget=forms.HiddenInput(),
    )

    version_name = forms.CharField(
        label="Nome da versão",
        max_length=100,
        required=False,
        widget=forms.TextInput(
            attrs={
                "class": "form-control",
                "placeholder": "Ex: Edição 2020",
            }
        ),
    )

    def clean(self):
        """Validate form based on choice."""
        cleaned_data = super().clean()
        choice = cleaned_data.get("choice")

        if choice == self.CHOICE_ADD_VERSION:
            # Se escolheu adicionar versão, precisa selecionar um hinário
            selected_hymnbook = cleaned_data.get("selected_hymnbook")
            version_name = cleaned_data.get("version_name")

            if not selected_hymnbook:
                raise forms.ValidationError("Você deve selecionar um hinário para adicionar a versão")

            if not version_name:
                raise forms.ValidationError("Você deve fornecer um nome para a versão")

        return cleaned_data


class HymnAudioUploadForm(forms.ModelForm):
    """Form para upload de áudio de hino."""

    class Meta:
        from .models import HymnAudio

        model = HymnAudio
        fields = ["audio_file", "title", "source", "recorded_at", "credits", "allow_download"]
        widgets = {
            "audio_file": forms.FileInput(
                attrs={
                    "accept": "audio/mpeg,audio/ogg,audio/flac",
                    "class": "form-control",
                }
            ),
            "title": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Ex: Gravação Studio 2023",
                }
            ),
            "source": forms.TextInput(
                attrs={
                    "class": "form-control",
                    "placeholder": "Ex: Studio XYZ, Rio de Janeiro",
                }
            ),
            "recorded_at": forms.DateInput(
                attrs={
                    "type": "date",
                    "class": "form-control",
                }
            ),
            "credits": forms.Textarea(
                attrs={
                    "class": "form-control",
                    "placeholder": "Quem cantou, gravou, produziu...",
                    "rows": 3,
                }
            ),
        }

    def clean_audio_file(self):
        """Valida o arquivo de áudio."""
        audio_file = self.cleaned_data.get("audio_file")

        if audio_file:
            # Validar tamanho (max 25MB)
            if audio_file.size > 25 * 1024 * 1024:
                raise forms.ValidationError("O arquivo não pode ter mais de 25MB.")

            # Validar extensão
            valid_extensions = [".mp3", ".ogg", ".flac"]
            if not any(audio_file.name.lower().endswith(ext) for ext in valid_extensions):
                raise forms.ValidationError("Formato inválido. Use MP3, OGG ou FLAC.")

        return audio_file
