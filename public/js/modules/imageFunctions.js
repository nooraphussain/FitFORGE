export function initializeThumbnails() {
    document.addEventListener('DOMContentLoaded', function () {
        const thumbnails = document.querySelectorAll('.thumbnail');
        const mainImage = document.getElementById('mainImage');

        if (thumbnails.length > 0) {
            thumbnails[0].classList.add('active');
        }

        thumbnails.forEach(thumbnail => {
            thumbnail.addEventListener('click', function () {
                console.log('Thumbnail clicked:', this);

                const imgDiv = document.getElementById('img-add');

                thumbnails.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                const newSrc = this.getAttribute('data-image');

                mainImage.src = newSrc;
                imgDiv.src = newSrc;
            });
        });
    });
}

export function initializeZoomEffect() {
    document.addEventListener('DOMContentLoaded', function () {
        const imgDiv = document.getElementById('img-add');
        const zoomBox = document.getElementById('zoomBox');
        const zoomImage = document.getElementById('zoomImage');

        imgDiv.addEventListener('mouseenter', function () {
            if (imgDiv.src) {
                zoomImage.src = imgDiv.src;
                zoomBox.style.display = 'block';
            }
        });

        imgDiv.addEventListener('mousemove', function (e) {
            const rect = imgDiv.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;

            zoomImage.style.transform = `translate(-${x}%, -${y}%)`;
        });

        imgDiv.addEventListener('mouseleave', function () {
            zoomBox.style.display = 'none';
        });
    });
}

export function initializeScrollImages() {
    let scrollIndex = 0;
    const container = document.getElementById("imageContainer");
    const images = document.querySelectorAll(".product-image");
    if (images.length === 0) return; // Prevent errors if no images exist

    const imageHeight = images[0].clientHeight + parseInt(window.getComputedStyle(images[0]).marginBottom);
    const upBtn = document.getElementById("scrollUp");
    const downBtn = document.getElementById("scrollDown");
    const visibleImages = 3;
    const totalImages = images.length;
    const maxScroll = totalImages - visibleImages;

    function updateButtons() {
        upBtn.style.display = scrollIndex > 0 ? "block" : "none";
        downBtn.style.display = scrollIndex < maxScroll ? "block" : "none";
    }

    window.scrollImages = function (direction) {
        let newScrollIndex = scrollIndex + direction;

        if (newScrollIndex < 0) newScrollIndex = 0;
        if (newScrollIndex > maxScroll) newScrollIndex = maxScroll;

        scrollIndex = newScrollIndex;
        container.style.transform = `translateY(-${scrollIndex * imageHeight}px)`;
        updateButtons();
    };

    function adjustContainerHeight() {
        const containerHeight = visibleImages * imageHeight;
        document.querySelector(".img-esquerda").style.height = `${containerHeight}px`;
    }

    window.onload = () => {
        adjustContainerHeight();
        updateButtons();
    };
}
