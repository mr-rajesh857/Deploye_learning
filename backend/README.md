# FastAPI Backend

## Activate Virtual Environment & Run Server

```bash
# From the backend directory:
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- API Base URL: http://localhost:8000
- Swagger Documentation: http://localhost:8000/docs
- Adminer Database: http://localhost:8080/?pgsql=postgres&username=postgres&db=Leave_management&ns=public

To exit the virtual environment when done:
```bash
deactivate
```
