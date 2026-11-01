from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import models, database, bcrypt

# Secret key & algorithm settings for JWT signing
SECRET_KEY = "SUPER_SECRET_CAMPUS_CONNECT_KEY_CHANGE_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 Hours
ADMIN_EMAIL = "admin@campusconnect.edu"
ADMIN_PASSWORD = "AdminPassword123!"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# In backend/auth.py

def hash_password(password: str) -> str:
    # Truncate to 72 bytes to avoid bcrypt error
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    plain_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_bytes, hashed_bytes)

# 2. JWT Token Generation
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def ensure_admin_account() -> None:
    # Existing PostgreSQL enum types are not altered by SQLAlchemy create_all().
    with database.engine.begin() as connection:
        connection.exec_driver_sql(
            "ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'admin'"
        )

    db: Session = database.SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == ADMIN_EMAIL).first()
        if admin is None:
            admin = models.User(
                name="Campus Connect Admin",
                email=ADMIN_EMAIL,
                role=models.RoleEnum.admin,
                password_hash=hash_password(ADMIN_PASSWORD),
            )
            db.add(admin)
        else:
            admin.name = "Campus Connect Admin"
            admin.role = models.RoleEnum.admin
            if not verify_password(ADMIN_PASSWORD, admin.password_hash):
                admin.password_hash = hash_password(ADMIN_PASSWORD)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# 3. Dependency: Extract Current User from Token
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user