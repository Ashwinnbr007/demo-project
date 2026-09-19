
def transaction_history(data: dict) -> list[dict[str, any]]:
    """
        This function takes a data dictionary as input and returns the transaction history.
        The transaction history is a list of dictionaries containing the details of each transaction.
        
        Parameters:
        data (dict): A dictionary containing income and expenses.
        
        Returns:
        List[dict]: A list of dictionaries containing the transaction history.
    """

    transaction_histories = []
    for expense in data["expenses"]:
        transaction = {
            "desctiption": expense["description"],
            "amount": expense["amount"],
        }
        transaction_histories.append(transaction)
    return transaction_histories

def filter_total_expense_by_category(data: dict, category: str) -> int:
    """
        This function takes a data dictionary and category as input and returns the total expense for that category.
       
        Parameters:
        data (dict): A dictionary containing income and expenses.
        category (str): The category to filter expenses by.
        
        Returns:
        int: total expense in that category.
    """
    total = 0
    for expense in data["expenses"]:
        if expense["category"] == category:
            total += expense["amount"]
    return total

def filter_total_expense_by_date(data: dict, date: str) -> int:
    """
        This function takes a data dictionary and date as input and returns the total expense for that date.
       
        Parameters:
        data (dict): A dictionary containing income and expenses.
        date (str): The date to filter expenses by.
        
        Returns:
        int: total expense on that date.
    """
    total = 0
    for expense in data["expenses"]:
        if expense["date"] == date:
            total += expense["amount"]
    return total

def highest_spend_category(data: dict) -> str:
    """
        This function takes a data dictionary as input and returns the category with the highest total expense.
       
        Parameters:
        data (dict): A dictionary containing income and expenses.
        
        Returns:
        str: The category with the highest total expense.
    """
    category_expenses = {}
    for category in data["categories"]:
        category_expenses[category] = filter_total_expense_by_category(data, category)

    max_amount = 0
    max_category = ""

    for item in category_expenses:
        if category_expenses[item] > max_amount:
            max_amount = category_expenses[item]
            max_category = item

    return max_category

def lowest_spend_category(data: dict) -> str:
    """
        This function takes a data dictionary as input and returns the category with the lowest total expense.
       
        Parameters:
        data (dict): A dictionary containing income and expenses.
        
        Returns:
        str: The category with the lowest total expense.
    """
    category_expenses = {}
    for category in data["categories"]:
        category_expenses[category] = filter_total_expense_by_category(data, category)

    min_amount = float('inf')
    min_category = ""

    for item in category_expenses:
        if category_expenses[item] < min_amount:
            min_amount = category_expenses[item]
            min_category = item
    
    return "The minimum expense is for " + min_category + " with total as " + str(min_amount)

def expenses_greater_than(data: dict, price: float) -> list[dict[str, any]]:
    """
        This function takes a data dictionary, price float as input and returns the list of values greater than the input price
        
        Parameters:
        data (dict): A dictionary containing income and expenses.
        price (float): A float digit which represents price
        
        Returns:
        list[dict[str, any]]: List of expenses which satisfies the condition
    """
    final_list = []
    
    for expense in data["expenses"]:
        if expense["amount"] > price:
            final_list.append(expense)

    if not final_list:
        return "invalid"

    return final_list