messages = {
    # Common
    "welcome": (
        "👋 Welcome to C0de CRM Bot!\n\n"
        "I'll help you create and manage your orders with our programming studio."
    ),
    "welcome_select_language": (
        "🌐 Welcome! Please select your language:"
        "\n\n🌐 Добро пожаловать!"
        " Пожалуйста, выберите язык:"
    ),
    "main_menu": "📋 Main Menu\n\nWhat would you like to do?",
    "back": "⬅️ Back",
    "cancel": "❌ Cancel",
    "confirm": "✅ Confirm",
    "yes": "Yes",
    "no": "No",
    "error": "❌ An error occurred. Please try again.",
    "loading": "⏳ Loading...",
    # Buttons
    "btn_new_order": "📝 New Order",
    "btn_my_orders": "📋 My Orders",
    "btn_language": "🌐 Language",
    "btn_help": "❓ Help",
    # Orders
    "orders_title": "📋 Your Orders",
    "orders_empty": (
        "You don't have any orders yet.\n\nCreate your first order using the button below!"
    ),
    "order_limit": (
        "⚠️ You already have 2 open orders.\n\n"
        "Please wait for your current orders to be completed before creating new ones."
    ),
    # Order creation
    "order_create_title": "📝 Create New Order\n\nPlease enter the title of your project:",
    "order_create_description": (
        "📄 Great! Now describe your project in detail:\n\n"
        "(What do you need? What features? Any specific requirements?)"
    ),
    "order_create_cost": (
        "💰 What's your budget for this project? (in USD)\n\nExample: 500\n\n"
        "💡 Tip: If you don't know your budget, enter 0 and our programmers will propose their"
        " prices."
    ),
    "order_create_markers": (
        "🏷️ Select the technologies/stack for your project:\n\n"
        "(You can select multiple, then press Done)"
    ),
    "order_create_markers_done": "✅ Done",
    "order_create_payment": "💳 Select payment method:",
    "order_create_confirm": (
        "📋 Please confirm your order:\n\n"
        "<b>Title:</b> {title}\n"
        "<b>Description:</b> {description}\n"
        "<b>Budget:</b> ${cost}\n<b>Stack:</b> {markers}\n<b>Payment:</b> {payment}\n\n"
        "Is everything correct?"
    ),
    "order_created": (
        "✅ Your order has been created!\n\n"
        "It's now pending moderation. We'll notify you once it's approved."
    ),
    "order_cancelled": "❌ Order creation cancelled.",
    # Order details
    "order_details": (
        "📋 <b>Order #{id}</b>\n\n<b>Title:</b> {title}\n<b>Description:</b> {description}\n"
        "<b>Budget:</b> ${cost}\n<b>Status:</b> {status}\n<b>Stack:</b> {markers}\n"
        "<b>Created:</b> {created_at}"
    ),
    "order_chat": "💬 Chat with Support",
    "order_delete": "🗑️ Delete Order",
    "order_delete_confirm": (
        "⚠️ Are you sure you want to delete this order?\n\n<b>{title}</b>\n\n"
        "This action cannot be undone."
    ),
    "order_deleted": "✅ Order has been deleted successfully.",
    "order_delete_error": (
        "❌ Cannot delete this order. Only pending or rejected orders can be deleted."
    ),
    "delete_confirm_yes": "🗑️ Yes, Delete",
    "delete_confirm_no": "❌ No, Keep It",
    # Order statuses
    "status_pending_moderation": "⏳ Pending Moderation",
    "status_rejected": "❌ Rejected",
    "status_approved": "✅ Approved",
    "status_in_progress": "🔄 In Progress",
    "status_testing": "🧪 Testing",
    "status_completed": "✅ Completed",
    "status_delivered": "📦 Delivered",
    # Chat
    "chat_start": (
        "💬 Chat for Order: <b>{title}</b>\n\n"
        "Send your message and our support team will respond shortly."
    ),
    "chat_message_sent": "✅ Message sent!",
    "chat_new_message": "💬 New message from support:\n\n{message}",
    "chat_unsupported_file": "❌ This file type is not supported. Supported: PDF, DOC, XLS, PPT, TXT, ZIP, RAR, 7z, GZ, TAR.",
    "chat_file_too_large": "❌ File is too large. Maximum size is 10 MB.",
    "enter_chat": "💬 Enter Chat",
    "exit_chat": "⬅️ Exit Chat",
    "chat_support_message": "<b>{title}</b>\n\n{message}",
    # Payment methods (legacy - kept for backward compatibility)
    "payment_method1": "Payment Method 1",
    "payment_method2": "Payment Method 2",
    "payment_not_specified": "Not specified",
    # Language
    "language_select": "🌐 Select your language:",
    "language_changed": "✅ Language changed to English",
    # Help
    "help_text": """❓ <b>Help</b>

<b>How to create an order:</b>
1. Press "📝 New Order"
2. Enter the project title
3. Describe your project
4. Set your budget
5. Select technologies
6. Choose payment method
7. Confirm your order

<b>Order statuses:</b>
• ⏳ Pending Moderation - Your order is being reviewed
• ✅ Approved - Order accepted, waiting for assignment
• 🔄 In Progress - Developer is working on it
• 🧪 Testing - Project is being tested
• ✅ Completed - Work is done
• 📦 Delivered - Project delivered to you

<b>Need help?</b>
Use the chat feature in your order to contact support.""",
    # Notifications
    "notify_order_approved": (
        "✅ Great news! Your order <b>{title}</b> has been approved!\n\n"
        "Our team will start working on it soon."
    ),
    "notify_order_rejected": (
        "❌ Unfortunately, your order <b>{title}</b> was rejected.\n\n"
        "Please create a new order with more details."
    ),
    "notify_order_assigned": (
        "👨‍💻 A developer has been assigned to your order <b>{title}</b>!\n\n"
        "Work will begin shortly."
    ),
    "notify_order_status": "📋 Order <b>{title}</b> status updated:\n\n{status}",
    # Telegram verification
    "telegram_verification": (
        "✅ <b>CRM Account Linked!</b>\n\n"
        "Your Telegram account has been successfully linked to your C0de CRM account.\n\n"
        "You will now receive notifications about:\n• New orders in the system\n"
        "• Orders assigned to you\n• Important updates"
    ),
    # Staff notifications
    "staff_new_order": (
        "📋 <b>New Order Available!</b>\n\n<b>Title:</b> {title}\n\n"
        "A new order has been added to the Kanban board and is ready for work."
    ),
    "staff_order_assigned": (
        "👨‍💻 <b>Order Assigned to You!</b>\n\n<b>Title:</b> {title}\n\n"
        "You have been assigned to this order. Please check the CRM for details."
    ),
    "staff_new_response": (
        "📝 <b>New Response to Order!</b>\n\n"
        "<b>Title:</b> {title}\n"
        "<b>Responder:</b> {username}\n\n"
        "A programmer has responded to this order. Please review their application and decide"
        " whether to assign them."
    ),
    "staff_new_order_moderation": (
        "🔔 <b>New Order for Moderation!</b>\n\n<b>Title:</b> {title}\n\n"
        "A new order has been submitted and is waiting for your review. Please approve or reject"
        " it."
    ),
    "staff_chat_access_granted": (
        "💬 <b>Chat Access Granted!</b>\n\n<b>Title:</b> {title}\n\n"
        "You have been granted access to chat with the customer for this order."
    ),
    "staff_payment_info_sent": (
        "💳 <b>Payment Info Received!</b>\n\n<b>Title:</b> {title}\n\n"
        "Payment details have been sent for this order. Check the CRM for details."
    ),
    # Customer payment notification
    "notify_payment_info": (
        "💳 <b>Payment Details for Your Order</b>\n\n<b>Order:</b> {title}\n"
        "<b>Payment Method:</b> {payment_method}\n<b>Amount:</b> ${amount}\n\n"
        "<b>Payment Details:</b>\n<code>{details}</code>\n\n"
        "Please complete the payment using the details above."
    ),
    # Staff notification button
    "open_order": "📋 Open Order",
}
