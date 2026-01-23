from projectk_core.db.connector import DBConnector

db = DBConnector()
athletes = db.client.table('athletes').select('id', count='exact').execute()
profiles = db.client.table('physio_profiles').select('id', count='exact').execute()
activities = db.client.table('activities').select('id', count='exact').execute()

print(f"Athletes count: {athletes.count}")
print(f"Profiles count: {profiles.count}")
print(f"Activities count: {activities.count}")
