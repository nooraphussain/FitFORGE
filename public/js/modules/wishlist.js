export default function initWishlist() {
    document.addEventListener("DOMContentLoaded", function () {
        const wishlistIcons = document.querySelectorAll(".wishlist-icon");

        wishlistIcons.forEach(icon => {
            icon.addEventListener("click", async function () {
                const productId = this.getAttribute("data-product-id");

                try {
                    const response = await fetch("/wishlist/add", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ productId }),
                    });

                    const result = await response.json();

                    if (result.success) {
                        this.style.color = "red"; 
                        alert("Added to wishlist!");
                    } else {
                        alert(result.message);
                    }
                } catch (error) {
                    console.error("Error adding to wishlist:", error);
                    alert("Failed to add to wishlist");
                }
            });
        });
    });
}
