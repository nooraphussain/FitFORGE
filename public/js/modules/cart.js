export default function initCart() {
    document.addEventListener("DOMContentLoaded", () => {
        console.log("Cart.js initialized ✅");

        const cartItems = document.querySelectorAll(".cart-product-count");
        if (cartItems.length === 0) {
            console.error("❌ No cart items found! Check your HTML structure.");
            return;
        }

        cartItems.forEach((item) => {
            const minusButton = item.querySelector(".minus-count");
            const plusButton = item.querySelector(".plus-count");
            const countSpan = item.querySelector(".cart-count");
            const productNameElement = item.closest(".cart-item-datas")?.querySelector(".style-58");

            const salePriceElement = item.closest(".cart-item-datas")?.querySelector(".preco-novo");
            const originalPriceElement = item.closest(".cart-item-datas")?.querySelector(".preco-ant");

            if (!minusButton || !plusButton || !countSpan || !productNameElement || !salePriceElement || !originalPriceElement) {
                console.error("❌ Missing elements in cart item.");
                return;
            }

            const productName = productNameElement.textContent.trim(); // Get actual product name
            const baseSalePrice = parseFloat(salePriceElement.innerText.replace("$", "")) || 0;
            const baseOriginalPrice = parseFloat(originalPriceElement.innerText.replace("$", "")) || 0;

            function showAlert(message, type = "success") {
                Swal.fire({
                    icon: type,
                    title: type === "error" ? "Limit Reached" : "Quantity Updated",
                    text: message,
                    timer: 1500,
                    showConfirmButton: false,
                });
            }

            function updatePrices(quantity) {
                salePriceElement.innerText = `$${(baseSalePrice * quantity).toFixed(2)}`;
                originalPriceElement.innerText = `$${(baseOriginalPrice * quantity).toFixed(2)}`;
            }

            function updateMessage() {
                const count = countSpan.textContent;
                updatePrices(parseInt(count)); // Update price on quantity change
                showAlert(`You've changed '${productName}' QUANTITY to ${count}`);
            }

            function checkLimits() {
                const count = parseInt(countSpan.textContent);
                minusButton.disabled = count === 1;
            }

            plusButton.addEventListener("click", () => {
                let count = parseInt(countSpan.textContent);
                const cartBlock = plusButton.closest(".cart-block");
                const availableStock = parseInt(cartBlock.getAttribute("data-stock"));

                const allowedLimit = Math.min(5, availableStock);
                if (count < allowedLimit) { 
                    count++;
                    countSpan.textContent = count;
                    updateMessage();
                    updateOrderSummary(); 
                } else {
                    if (availableStock < 5) {
                        showAlert(`We're sorry! Only ${availableStock} units of '${productName}' available`, "error");
                    } else {
                        showAlert(`We're sorry! Only ${allowedLimit} units of '${productName}' allowed in each order`, "error");
                    }
                }
                checkLimits();
            });
            
            
            minusButton.addEventListener("click", () => {
                let count = parseInt(countSpan.textContent);
                if (count > 1) {
                    count--;
                    countSpan.textContent = count;
                    updateMessage();
                    updateOrderSummary(); // Update order summary dynamically
                }
                checkLimits();
            });
            
            checkLimits();
        });
    });
}
