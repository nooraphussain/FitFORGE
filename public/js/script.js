import initMenu from "./modules/menu.js";
import initScrollSuave from "./modules/scrollsuave.js";
import initScrollAnimado from "./modules/animascroll.js";
import initModal from "./modules/modal.js";
import initTabproduto from "./modules/tabproduto.js";
import { initializeThumbnails, initializeZoomEffect, initializeScrollImages } from "./modules/imageFunctions.js";
//import updateCartCount from "./modules/updateCartCount.js";
import initWishlist from "./modules/wishlist.js";
import initCart from "./modules/cart.js"; 
import { toggleEdit, initEditFunctions } from "./modules/editProfile.js";  

// Initialize all functions
initTabproduto();
initModal();
initScrollAnimado();
initScrollSuave();
initMenu();
//updateCartCount();
initializeThumbnails();
initializeZoomEffect();
initializeScrollImages();
//initWishlist();
initCart();
initEditFunctions();
toggleEdit();