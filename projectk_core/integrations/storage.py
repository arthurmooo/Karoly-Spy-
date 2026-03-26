from ..db.connector import DBConnector

class StorageManager:
    BUCKET_NAME = "raw_fits"
    
    def __init__(self):
        self.db = DBConnector()
        self.client = self.db.client
        
    def upload_fit_file(self, athlete_id: str, nolio_id: int, content: bytes, year: str) -> str:
        """
        Uploads a FIT file to Supabase Storage.
        Path format: {athlete_id}/{year}/{nolio_id}.fit
        Returns the path in the bucket.
        """
        path = f"{athlete_id}/{year}/{nolio_id}.fit"
        
        try:
            # upsert='false' ensures we don't silently overwrite
            self.client.storage.from_(self.BUCKET_NAME).upload(
                path=path,
                file=content,
                file_options={"content-type": "application/octet-stream", "upsert": "false"}
            )
        except Exception as e:
            # Check if it's a "Duplicate" error (409)
            # Depending on the Supabase Python SDK version, the error might be in different formats
            err_msg = str(e).lower()
            if "duplicate" in err_msg or "already exists" in err_msg or "409" in err_msg:
                # File is already there, we just return the path to update the DB
                return path
            else:
                # Other error, re-raise
                raise e
        
        return path

    def download_fit_file(self, path: str) -> bytes | None:
        """
        Downloads a file from the bucket given its path.
        Returns None if the file is not found (404 / ghost entry).
        """
        try:
            return self.client.storage.from_(self.BUCKET_NAME).download(path)
        except Exception as e:
            err_msg = str(e).lower()
            if "404" in err_msg or "not found" in err_msg or "Expecting value" in str(e):
                print(f"      ⚠️ Storage 404: {path} (ghost entry or missing blob)")
                return None
            raise
