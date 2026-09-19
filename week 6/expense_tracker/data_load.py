import json

def import_data(file_path):
    with open(file_path, "r") as f:
        data = json.load(f)
    return data

def write_data(data: dict, file_path: str):
    with open(file_path, "w") as file:
        json.dump(data, file)
