

def balance(data: dict) -> int:
    """
        This function takes a data dictionary as input and returns the balance amount.
        The balance is calculated by subtracting the total expenses from the income.
        
        Parameters:
        data (dict): A dictionary containing income and expenses.
        
        Returns:
        int: The balance amount.
    """

    return data["income"] - total_expenses(data)

def total_expenses(data: dict) -> float:
    """
        This function takes a data dictionary as input and returns the total expenses.
        The total expenses is calculated by summing up all the expenses in the data.
        
        Parameters:
        data (dict): A dictionary containing income and expenses.
        
        Returns:
        float: The total expenses amount.
    """

    total_expenses = 0

    for expense in data["expenses"]:
        total_expenses += expense["amount"]

    return total_expenses