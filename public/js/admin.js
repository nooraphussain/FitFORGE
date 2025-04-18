document.addEventListener("DOMContentLoaded", () => {
	// SIDEBAR HIGHLIGHTING
	const allSideMenu = document.querySelectorAll("#sidebar .side-menu.top li a")
	const currentPath = window.location.pathname
  
	console.log("Current path:", currentPath)
  
	// Direct path matching for specific pages
	if (currentPath === "/admin/coupons") {
	  highlightMenuItem("Coupons")
	} else if (currentPath === "/admin/wallet") {
	  highlightMenuItem("Wallet")
	} else if (currentPath.includes("/admin/message") || currentPath === "/admin/message") {
	  highlightMenuItem("Message")
	} else if (currentPath === "/admin") {
	  highlightMenuItem("Dashboard")
	} else if (currentPath === "/admin/products") {
	  highlightMenuItem("Products")
	} else if (currentPath === "/admin/orders") {
	  highlightMenuItem("Orders")
	} else if (currentPath === "/admin/category") {
	  highlightMenuItem("Categories")
	} else if (currentPath === "/admin/customers") {
	  highlightMenuItem("Customers")
	} else {
	  // For other pages, try to match by href
	  let activeItemFound = false
  
	  allSideMenu.forEach((item) => {
		const href = item.getAttribute("href")
  
		// Skip items with href="#"
		if (href === "#") return
  
		// For other pages, match if the current path starts with the href
		if (href !== "/admin" && currentPath.startsWith(href)) {
		  removeAllActive()
		  item.parentElement.classList.add("active")
		  activeItemFound = true
		}
	  })
  
	  // If no match found and we're on an admin page, default to dashboard
	  if (!activeItemFound && currentPath.startsWith("/admin")) {
		highlightMenuItem("Dashboard")
	  }
	}
  
	// Helper function to highlight menu item by text
	function highlightMenuItem(text) {
	  removeAllActive()
  
	  allSideMenu.forEach((item) => {
		const itemText = item.querySelector(".text")?.textContent.trim()
		if (itemText === text) {
		  item.parentElement.classList.add("active")
		}
	  })
	}
  
	// Helper function to remove all active classes
	function removeAllActive() {
	  allSideMenu.forEach((item) => {
		item.parentElement.classList.remove("active")
	  })
	}
  
	// TOGGLE SIDEBAR
	const menuBar = document.querySelector("#content nav .bx.bx-menu")
	const sidebar = document.getElementById("sidebar")
  
	if (menuBar) {
	  menuBar.addEventListener("click", () => {
		sidebar.classList.toggle("hide")
	  })
	}
  
	// SEARCH FUNCTIONALITY
	const searchButton = document.querySelector("#content nav form .form-input button")
	const searchButtonIcon = document.querySelector("#content nav form .form-input button .bx")
	const searchForm = document.querySelector("#content nav form")
  
	if (searchButton && searchButtonIcon && searchForm) {
	  searchButton.addEventListener("click", (e) => {
		if (window.innerWidth < 576) {
		  e.preventDefault()
		  searchForm.classList.toggle("show")
		  if (searchForm.classList.contains("show")) {
			searchButtonIcon.classList.replace("bx-search", "bx-x")
		  } else {
			searchButtonIcon.classList.replace("bx-x", "bx-search")
		  }
		}
	  })
	}
  
	// RESPONSIVE BEHAVIOR
	if (window.innerWidth < 768) {
	  sidebar.classList.add("hide")
	} else if (window.innerWidth > 576 && searchButtonIcon && searchForm) {
	  searchButtonIcon.classList.replace("bx-x", "bx-search")
	  searchForm.classList.remove("show")
	}
  
	window.addEventListener("resize", function () {
	  if (this.innerWidth > 576 && searchButtonIcon && searchForm) {
		searchButtonIcon.classList.replace("bx-x", "bx-search")
		searchForm.classList.remove("show")
	  }
	})
  
	// DARK MODE TOGGLE - COMPLETELY REVISED
	const switchMode = document.getElementById("switch-mode")
  
	// Check if dark mode was previously enabled
	const isDarkMode = localStorage.getItem("darkMode") === "true"
  
	// Apply dark mode if it was previously enabled
	if (isDarkMode) {
	  document.body.classList.add("dark")
	  if (switchMode) {
		switchMode.checked = true
	  }
	}
  
	if (switchMode) {
	  // Force a change event to ensure the listener is attached
	  switchMode.addEventListener("click", function () {
		const isChecked = this.checked
		console.log("Dark mode toggled:", isChecked)
  
		if (isChecked) {
		  document.body.classList.add("dark")
		  localStorage.setItem("darkMode", "true")
		} else {
		  document.body.classList.remove("dark")
		  localStorage.setItem("darkMode", "false")
		}
	  })
	}
  
	// Add click event listeners for sidebar items
	allSideMenu.forEach((item) => {
	  item.addEventListener("click", function () {
		const itemText = this.querySelector(".text")?.textContent.trim()
		console.log("Menu item clicked:", itemText)
  
		// Store the clicked menu item in localStorage
		if (itemText) {
		  localStorage.setItem("activeMenuItem", itemText)
		}
	  })
	})
  
	// Check if there's a stored active menu item
	const storedActiveMenuItem = localStorage.getItem("activeMenuItem")
	if (storedActiveMenuItem && !currentPath.includes(storedActiveMenuItem.toLowerCase())) {
	  // Only apply if we're not already on a matching page
	  highlightMenuItem(storedActiveMenuItem)
	}
  })
  