"""Gmail SMTP üzerinden tek hesaptan şablonlu e-posta gönderimi.

Tek Gmail/Google Workspace hesabı (SMTP_USER) + 16 haneli App Password ile gönderir.
Gmail 'From' başlığını kimlik doğrulanan hesaba yeniden yazdığı için From sabittir
(görünen ad şirket adı olur), seçilen şirketin e-postası Reply-To'ya yazılır.

Mailler HTML (kalın yazı, link, logo) + düz metin yedeği olarak gönderilir. İçerikte
basit biçimlendirme desteklenir: **kalın**, [metin](https://link), ve düz URL'ler.

Stdlib smtplib + email.message kullanılır — yeni bağımlılık yok. Gönderim hatası
çağıranı KIRMAMALI; hatayı çağıran taraf (BackgroundTask) yakalayıp loglar."""

import re
import smtplib
import socket
import ssl
from email.message import EmailMessage
from html import escape as _html_escape

_VAR_RE = re.compile(r"\{([a-z0-9_]+)\}")


def _connect_ipv4(host: str, port: int, timeout: int) -> socket.socket:
    """IPv4 (AF_INET) zorlayarak bağlanır. Railway gibi IPv6 yolu olmayan ortamlarda
    Gmail'in IPv6 adresine düşüp '[Errno 101] Network is unreachable' almayı önler."""
    last_err = None
    for af, socktype, proto, _canon, sa in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        sock = None
        try:
            sock = socket.socket(af, socktype, proto)
            sock.settimeout(timeout)
            sock.connect(sa)
            return sock
        except OSError as e:
            last_err = e
            if sock is not None:
                try:
                    sock.close()
                except OSError:
                    pass
    raise last_err or OSError(f"{host}:{port} için IPv4 bağlantısı kurulamadı")


class _SMTP_SSL_IPv4(smtplib.SMTP_SSL):
    """SMTP_SSL ama bağlantıyı IPv4'e zorlar. TLS sunucu adı doğrulaması korunur."""
    def _get_socket(self, host, port, timeout):
        sock = _connect_ipv4(host, port, timeout)
        return self.context.wrap_socket(sock, server_hostname=self._host)


class _SMTP_IPv4(smtplib.SMTP):
    """SMTP (STARTTLS) ama bağlantıyı IPv4'e zorlar."""
    def _get_socket(self, host, port, timeout):
        return _connect_ipv4(host, port, timeout)
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\s)]+)\)")
_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")
_BARE_URL_RE = re.compile(r"(https?://[^\s<]+)")


def smtp_configured(smtp: dict | None) -> bool:
    """Verilen SMTP ayar sözlüğü gönderim için yeterli mi?
    smtp: {host, port, use_ssl, user, password, from_name}."""
    return bool(smtp and smtp.get("host") and smtp.get("user") and smtp.get("password"))


def _format_value(value) -> str:
    """Form cevabını şablona girecek okunabilir bir string'e çevirir.
    (seminar_forms._format_answer_value mantığıyla aynı.)"""
    if value is None:
        return ""
    if isinstance(value, dict):  # telefon {"code": "+90", "number": "..."}
        code = (value.get("code") or "").strip()
        num = (value.get("number") or "").strip()
        return f"{code} {num}".strip()
    if isinstance(value, bool):
        return "Evet" if value else "Hayır"
    if isinstance(value, (list, tuple)):
        return ", ".join(str(x) for x in value)
    return str(value)


def render_template(text: str, answers: dict) -> str:
    """Metindeki {alan_anahtari} kalıplarını answers değerleriyle değiştirir.
    Bilinmeyen anahtar boş string'e düşer (KeyError yok)."""
    if not text:
        return ""
    answers = answers or {}
    return _VAR_RE.sub(lambda m: _format_value(answers.get(m.group(1))), text)


def _markdownish_to_html(text: str) -> str:
    """Basit biçimlendirmeyi güvenli HTML'e çevirir: **kalın**, [metin](url),
    düz URL'ler ve satır sonları. Önce HTML kaçışı yapılır (injection'a karşı)."""
    if not text:
        return ""
    escaped = _html_escape(text)

    # Markdown linkleri önce çıkar (placeholder ile koru), sonra düz URL'leri linkle.
    anchors: list[str] = []

    def _stash_link(m):
        label, url = m.group(1), m.group(2)
        anchors.append(f'<a href="{url}" target="_blank" rel="noopener" style="color:#7c3aed;">{label}</a>')
        return f"\x00{len(anchors) - 1}\x00"

    out = _MD_LINK_RE.sub(_stash_link, escaped)
    out = _BOLD_RE.sub(r"<strong>\1</strong>", out)
    out = _BARE_URL_RE.sub(
        lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener" style="color:#7c3aed;">{m.group(1)}</a>',
        out,
    )
    out = out.replace("\n", "<br>\n")
    # Korunan linkleri geri yerleştir.
    out = re.sub(r"\x00(\d+)\x00", lambda m: anchors[int(m.group(1))], out)
    return out


def build_email_html(body_text: str, logo_url: str | None = None, from_name: str | None = None) -> str:
    """İçerik metnini logo başlıklı, basit ve mail-istemci-dostu bir HTML şablonuna sarar."""
    body_html = _markdownish_to_html(body_text)
    header = ""
    if logo_url:
        safe_logo = _html_escape(logo_url, quote=True)
        alt = _html_escape(from_name or "", quote=True)
        header = (
            f'<div style="text-align:center;padding-bottom:16px;">'
            f'<img src="{safe_logo}" alt="{alt}" style="max-height:64px;max-width:220px;object-fit:contain;"></div>'
        )
    return (
        '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;">'
        '<div style="max-width:560px;margin:0 auto;padding:24px;">'
        '<div style="background:#ffffff;border-radius:16px;padding:28px;'
        'font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;">'
        f"{header}"
        f"<div>{body_html}</div>"
        "</div>"
        '<div style="text-align:center;color:#94a3b8;font-size:12px;padding-top:14px;'
        'font-family:Arial,Helvetica,sans-serif;">Bu e-posta otomatik olarak gönderilmiştir.</div>'
        "</div></body></html>"
    )


def send_email(to: str, subject: str, body: str, *, smtp: dict,
               reply_to: str | None = None, from_name: str | None = None,
               logo_url: str | None = None) -> None:
    """Tek bir e-posta gönderir (HTML + düz metin yedeği). SMTP yapılandırılmamışsa no-op.

    smtp: {host, port, use_ssl, user, password, from_name} (DB'den ya da env fallback).
    `body` basit biçimlendirme içerebilir (**kalın**, [metin](url)). Hata fırlatabilir
    (SMTP/ağ); çağıran taraf yakalamalıdır."""
    if not smtp_configured(smtp) or not to:
        return

    user = smtp["user"]
    display = (from_name or smtp.get("from_name") or "").strip()

    msg = EmailMessage()
    msg["From"] = f"{display} <{user}>" if display else user
    msg["To"] = to
    msg["Subject"] = subject or ""
    if reply_to:
        msg["Reply-To"] = reply_to

    msg.set_content(body or "")  # düz metin yedeği
    msg.add_alternative(build_email_html(body or "", logo_url, from_name), subtype="html")

    host = smtp["host"]
    port = int(smtp.get("port") or 465)
    ctx = ssl.create_default_context()
    if smtp.get("use_ssl", True):  # 465 (SSL)
        with _SMTP_SSL_IPv4(host, port, context=ctx, timeout=20) as s:
            s.login(user, smtp["password"])
            s.send_message(msg)
    else:  # 587 (STARTTLS)
        with _SMTP_IPv4(host, port, timeout=20) as s:
            s.starttls(context=ctx)
            s.login(user, smtp["password"])
            s.send_message(msg)
