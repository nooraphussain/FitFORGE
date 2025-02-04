// Select all the side menu links
const allSideMenu = document.querySelectorAll('#sidebar .side-menu.top li a');

// Handle active class on side menu items
allSideMenu.forEach(item => {
    const li = item.parentElement;

    item.addEventListener('click', function () {
        allSideMenu.forEach(i => {
            i.parentElement.classList.remove('active'); // Remove active from all
        });
        li.classList.add('active'); // Add active to clicked item
    });
});


// TOGGLE SIDEBAR
const menuBar = document.querySelector('#content nav .bx.bx-menu');
const sidebar = document.getElementById('sidebar');

// Toggle sidebar visibility on menu bar click
menuBar.addEventListener('click', function () {
    sidebar.classList.toggle('hide'); // Toggle 'hide' class to show/hide sidebar
});

// Handle active class for side menu links based on the current URL
document.addEventListener("DOMContentLoaded", function () {
    const currentPath = window.location.pathname;
    sideMenuLinks.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.parentElement.classList.add('active'); // Add active class to current page link
        }
    });
});

// DROP-DOWN MENU TOGGLE
document.querySelectorAll('.dots-btn').forEach(button => {
    button.addEventListener('click', function (event) {
        event.stopPropagation(); // Prevent closing when clicking inside
        let dropdown = this.closest('.dropdown');
        dropdown.classList.toggle('show'); // Toggle dropdown visibility

        // Close all other dropdowns
        document.querySelectorAll('.dropdown').forEach(d => {
            if (d !== dropdown) d.classList.remove('show');
        });
    });
});

// Close all dropdowns when clicking outside
document.addEventListener('click', function () {
    document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('show'));
});

// SEARCH FUNCTIONALITY
const searchButton = document.querySelector('#content nav form .form-input button');
const searchButtonIcon = document.querySelector('#content nav form .form-input button .bx');
const searchForm = document.querySelector('#content nav form');

searchButton.addEventListener('click', function (e) {
    if (window.innerWidth < 576) {
        e.preventDefault();
        searchForm.classList.toggle('show');
        // Toggle search icon
        if (searchForm.classList.contains('show')) {
            searchButtonIcon.classList.replace('bx-search', 'bx-x');
        } else {
            searchButtonIcon.classList.replace('bx-x', 'bx-search');
        }
    }
});

// Sidebar visibility based on screen width
if (window.innerWidth < 768) {
    sidebar.classList.add('hide');
} else if (window.innerWidth > 576) {
    searchButtonIcon.classList.replace('bx-x', 'bx-search');
    searchForm.classList.remove('show');
}

// Handle window resize
window.addEventListener('resize', function () {
    if (this.innerWidth > 576) {
        searchButtonIcon.classList.replace('bx-x', 'bx-search');
        searchForm.classList.remove('show');
    }
});

// DARK MODE TOGGLE
const switchMode = document.getElementById('switch-mode');

switchMode.addEventListener('change', function () {
    if (this.checked) {
        document.body.classList.add('dark');
    } else {
        document.body.classList.remove('dark');
    }
});
