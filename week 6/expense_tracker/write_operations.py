from data_load import import_data, write_data

def add_category(file_path: str, category: str):

    data: dict = import_data(file_path)
    data["categories"].append(category)
    write_data(data, file_path)
    return "Success"