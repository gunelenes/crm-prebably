from dotenv import load_dotenv
import os

load_dotenv()

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID")
INSTAGRAM_TOKEN = os.getenv("INSTAGRAM_TOKEN")
WEBHOOK_VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN")
# Meta'nın giden ses dosyalarını çekebilmesi için herkese açık (public) HTTPS taban adresi.
# Sonunda /api OLMADAN verilmeli — örn. https://crm-prebably-production.up.railway.app
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://crm-prebably-production.up.railway.app")
# DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost:3306/crm_db")

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7