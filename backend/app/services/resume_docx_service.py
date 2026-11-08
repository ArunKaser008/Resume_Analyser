from html.parser import HTMLParser
from io import BytesIO

from docx import Document

from app.services.resume_preview_service import ResumePreviewService


class _ResumeHTMLParser(HTMLParser):
    BLOCKS = {
        "h1": "Title",
        "h2": "Heading 1",
        "h3": "Heading 2",
        "p": "Normal",
        "li": "List Bullet",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[tuple[str, str]] = []
        self._active_tag: str | None = None
        self._active_style = "Normal"
        self._text: list[str] = []
        self._ignored = 0
        self._source_content = False

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "head"}:
            self._ignored += 1
            return
        if self._ignored:
            return
        if tag == "br" and self._active_tag:
            self._text.append("\n")
        if tag in self.BLOCKS:
            self._finish_paragraph()
            self._active_tag = tag
            self._active_style = self.BLOCKS[tag]
            self._source_content = (
                tag == "p"
                and "source-content"
                in dict(attrs).get("class", "").split()
            )

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "head"}:
            self._ignored = max(0, self._ignored - 1)
            return
        if self._ignored:
            return
        if tag == self._active_tag:
            self._finish_paragraph()

    def handle_data(self, data: str) -> None:
        if self._active_tag and not self._ignored:
            self._text.append(data)

    def _finish_paragraph(self) -> None:
        value = "".join(self._text)
        if self._source_content:
            lines = [line.strip() for line in value.splitlines() if line.strip()]
            self.paragraphs.extend(
                (self._active_style, line) for line in lines
            )
        else:
            text = " ".join(value.split())
            if text:
                self.paragraphs.append((self._active_style, text))
        self._text = []
        self._active_tag = None
        self._active_style = "Normal"
        self._source_content = False


class ResumeDOCXService:
    @staticmethod
    def generate_docx(db, resume_id) -> bytes:
        html_content = ResumePreviewService.generate_preview(
            db=db,
            resume_id=resume_id,
        )
        parser = _ResumeHTMLParser()
        parser.feed(html_content)

        document = Document()
        for style, text in parser.paragraphs:
            document.add_paragraph(text, style=style)

        output = BytesIO()
        document.save(output)
        return output.getvalue()
