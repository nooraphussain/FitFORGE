document.addEventListener("DOMContentLoaded", function () {
    const conta = document.querySelector(".conta");
    const dropdown = document.querySelector(".dropdown-menu");
  
    conta.addEventListener("click", function (e) {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === "flex" ? "none" : "flex";
    });
  
    document.addEventListener("click", function (e) {
      if (!dropdown.contains(e.target) && e.target !== conta) {
        dropdown.style.display = "none";
      }
    });
  });
  


  