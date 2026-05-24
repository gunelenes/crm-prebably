"""
Yeni kullanıcı için INSERT SQL üretir (admin veya user).

Kullanım:
    python create_admin.py

Sorduğu bilgileri yazınca ekrana çalıştırılacak SQL'i basar.
Bu SQL'i Railway DB konsoluna (veya psql ile) yapıştırıp çalıştır.

Not: Admin olarak girdikten sonra UI'daki /kullanicilar paneli aynı işi
hash'i otomatik üreterek yapar — bu script sadece UI'a erişemediğin
durumlar (ilk admin, parola sıfırlama vb.) için.
"""

import bcrypt
import getpass
import sys


def main():
    print("=" * 60)
    print("Kullanıcı INSERT SQL üretici")
    print("=" * 60)

    username = input("Kullanıcı adı: ").strip()
    if not username:
        print("  ! Kullanıcı adı boş olamaz.")
        sys.exit(1)
    full_name = input("Ad Soyad: ").strip() or username

    role = input("Rol [user/admin] (varsayılan: user): ").strip().lower() or "user"
    if role not in ("user", "admin"):
        print("  ! Rol sadece 'user' veya 'admin' olabilir.")
        sys.exit(1)

    while True:
        password = getpass.getpass("Parola (min 6 karakter): ")
        if len(password) < 6:
            print("  ! Parola en az 6 karakter olmalı, tekrar dene.")
            continue
        confirm = getpass.getpass("Parola (tekrar): ")
        if password != confirm:
            print("  ! Parolalar eşleşmedi, tekrar dene.")
            continue
        break

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    # SQL injection'a karşı tek tırnakları escape et
    safe_username = username.replace("'", "''")
    safe_full_name = full_name.replace("'", "''")

    sql = (
        "INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)\n"
        f"VALUES ('{safe_username}', '{hashed}', '{safe_full_name}', '{role}', true, NOW());"
    )

    print()
    print("-" * 60)
    print(f"Rol: {role}")
    print("Aşağıdaki SQL'i Railway DB konsolunda çalıştır:")
    print("-" * 60)
    print(sql)
    print("-" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nİptal edildi.")
        sys.exit(1)
