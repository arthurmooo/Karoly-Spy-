from ..db.connector import DBConnector

class StorageManager:
    BUCKET_NAME = "raw_fits"
    
    def __init__(self):
        self.db = DBConnector()
        self.client = self.db.client
        
    def upload_fit_file(self, athlete_id: int, nolio_id: int, content: bytes, year: str) -> str:
        """
        Uploads a FIT file to Supabase Storage.
        Path format: {athlete_id}/{year}/{nolio_id}.fit
        Returns the path in the bucket.
        """
        path = f"{athlete_id}/{year}/{nolio_id}.fit"
        
        # 'file_options' keys might vary by SDK version, but 'content-type' and 'upsert' are standard.
        # upsert='false' ensures we don't silently overwrite (though hash check logic should prevent this upstream).
        self.client.storage.from_(self.BUCKET_NAME).upload(
            path=path,
            file=content,
            file_options={"content-type": "application/octet-stream", "upsert": "false"}
        )
        
        return path

    def download_fit_file(self, path: str) -> bytes:
        """
        Downloads a file from the bucket given its path.
        """
        return self.client.storage.from_(self.BUCKET_NAME).download(path)
