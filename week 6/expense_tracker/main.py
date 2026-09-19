import balance
import transactions as t
import write_operations as w
import data_load

file_path = "/Users/ashwinnambiar/Desktop/SDE Fundementals + AI Cohort/week 6/expense_tracker/data.json"

if __name__ == "__main__":
    exit = False
    data = data_load.import_data(file_path)
    
    while not exit:

        user_input = input("Options: \n" \
        "1. Calculate balance\n" \
        "2. Transaction history\n" \
        "3. Total Expenses\n" \
        "4. Filter by category\n" \
        "5. Filter by date\n" \
        "6. Highest category of spending\n" \
        "7. Lowest category of spending\n" \
        "8. Find expenses greater than an amount\n" \
        "9. Add a category \n"
        "10. Exit\n" \
        "Enter your choice: ")


        if user_input == "1":
            print("""\n--------""")
            print(balance.balance(data))
            print("""--------\n""")
        elif user_input == "2":
            print("""\n--------""")
            print(t.transaction_history(data))
            print("""--------\n""")
        elif user_input == "3":
            print(balance.total_expenses(data))
        elif user_input == "4":
            category = input("Enter category to filter by: ")
            print(t.filter_total_expense_by_category(data, category))
        elif user_input == "5":
            date = input("Enter date to filter by (YYYY-MM-DD): ")
            print(t.filter_total_expense_by_date(data, date))
        elif user_input == "6":
            print("""\n--------""")
            print(t.highest_spend_category(data))
            print("""--------\n""")
        
        elif user_input == "7":
            print("""\n--------""")
            print(t.lowest_spend_category(data))
            print("""--------\n""")
        
        elif user_input == "8":
            num = float(input("Enter a number: "))
            print("""\n--------""")
            print(t.expenses_greater_than(data, num))
            print("""--------\n""")
        elif user_input == "9":
            category = input("Enter a category: ")
            print("""\n--------""")
            print(w.add_category(file_path, category))
            print("""--------\n""")
        elif user_input == "9":
            exit = True    
        else: 
            print("Invalid input. Please try again.")
    