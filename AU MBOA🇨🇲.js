/**
 * ============================================================
 *  AU MBOA 🇨🇲 — JavaScript Principal
 *  Version : 2.0 | Auteur : Équipe Au MBOA
 *  Architecture : Modulaire ES6 — Prêt pour backend PHP/MySQL
 * ============================================================
 */

'use strict';

// ============================================================
// VARIABLES GLOBALES
// ============================================================

const STORAGE_KEYS = {
  panier: 'aumboa_panier',
  utilisateur: 'aumboa_utilisateur',
  theme: 'aumboa_theme',
  reservations: 'aumboa_reservations',
  commandes: 'aumboa_commandes',
  favoris: 'aumboa_favoris',
};

const FRAIS_SERVICE = 500;
const LIVRAISON_GRATUITE_SEUIL = 10000;

// ============================================================
// UTILITAIRES
// ============================================================

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

const storage = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn('Storage error:', e); } },
  remove: (key) => localStorage.removeItem(key),
};

const formatPrix = (prix) => `${prix.toLocaleString('fr-FR')} FCFA`;

const genererIdCommande = () => `MBOA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2,5).toUpperCase()}`;

const validerTelephoneCM = (tel) => /^(\+237|237)?[62][0-9]{8}$/.test(tel.replace(/\s/g, ''));

const validerEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};

// ============================================================
// LOADER
// ============================================================

function initLoader() {
  const loader = document.createElement('div');
  loader.id = 'aumboa-loader';
  loader.innerHTML = `
    <div class="loader-inner">
      <div class="loader-logo">🇨🇲</div>
      <div class="loader-text">Au MBOA</div>
      <div class="loader-bar"><div class="loader-progress"></div></div>
    </div>
  `;
  document.body.prepend(loader);

  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('loader-hide');
      setTimeout(() => loader.remove(), 600);
    }, 800);
  });
}

// ============================================================
// DARK MODE
// ============================================================

function initDarkMode() {
  const savedTheme = storage.get(STORAGE_KEYS.theme) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Créer le bouton switch
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', 'Basculer le thème');
  btn.setAttribute('title', savedTheme === 'dark' ? 'Mode clair' : 'Mode sombre');
  btn.innerHTML = savedTheme === 'dark' ? '☀️' : '🌙';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    storage.set(STORAGE_KEYS.theme, next);
    btn.innerHTML = next === 'dark' ? '☀️' : '🌙';
    btn.title = next === 'dark' ? 'Mode clair' : 'Mode sombre';
  });
}

// ============================================================
// NOTIFICATIONS (TOAST)
// ============================================================

function initNotifications() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
}

function showToast(message, type = 'success', duration = 3500) {
  const container = $('#toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ============================================================
// NAVBAR INTELLIGENTE
// ============================================================

function initNavbar() {
  const navbar = $('.navbar');
  if (!navbar) return;

  // Scroll effect
  window.addEventListener('scroll', debounce(() => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  }, 50));

  // Highlight section active
  const sections = $$('section[id], header[id]');
  const navLinks = $$('.nav-links a[href^="#"]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active-link', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  sections.forEach(s => observer.observe(s));

  // Menu hamburger mobile
  let hamburger = $('.hamburger');
  if (!hamburger) {
    hamburger = document.createElement('button');
    hamburger.className = 'hamburger';
    hamburger.setAttribute('aria-label', 'Menu');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    navbar.appendChild(hamburger);
  }

  const navMenu = $('.nav-links');
  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('nav-open');
    hamburger.classList.toggle('hamburger-active', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen.toString());
  });

  // Fermer menu sur clic lien
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu?.classList.remove('nav-open');
      hamburger.classList.remove('hamburger-active');
    });
  });

  // Badge panier
  updateBadgePanier();

  // Afficher utilisateur connecté
  updateNavbarAuth();
}

function updateBadgePanier() {
  const panier = getPanier();
  const total = panier.reduce((acc, item) => acc + item.quantite, 0);

  $$('.badge-panier').forEach(b => b.remove());

  const panierLinks = $$('.nav-links a[href*="commande"]');
  panierLinks.forEach(link => {
    if (total > 0) {
      const badge = document.createElement('span');
      badge.className = 'badge-panier';
      badge.textContent = total > 9 ? '9+' : total;
      badge.setAttribute('aria-label', `${total} article${total > 1 ? 's' : ''} dans le panier`);
      link.style.position = 'relative';
      link.appendChild(badge);
    }
  });
}

// ============================================================
// FILTRE MENU
// ============================================================

function initMenuFilter() {
  const filterBtns = $$('.filter-btn');
  const cards = $$('.mcard');

  if (!filterBtns.length || !cards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filtre = btn.dataset.filter;

      cards.forEach(card => {
        const categorie = card.dataset.category;
        const visible = filtre === 'all' || categorie === filtre;

        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        if (visible) {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          card.style.display = '';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            });
          });
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => { if (!visible) card.style.display = 'none'; }, 300);
        }
      });
    });
  });

  // Recherche dynamique menu
  initRechercheMenu();
}

function initRechercheMenu() {
  const menuTitle = $('.menu-title');
  if (!menuTitle) return;

  const searchBox = document.createElement('div');
  searchBox.className = 'menu-search';
  searchBox.innerHTML = `
    <input type="search" id="recherche-menu" placeholder="🔍 Rechercher un plat..." aria-label="Rechercher dans le menu">
  `;
  menuTitle.appendChild(searchBox);

  const input = $('#recherche-menu');
  const cards = $$('.mcard');

  input.addEventListener('input', debounce(() => {
    const query = input.value.toLowerCase().trim();
    cards.forEach(card => {
      const nom = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const desc = card.querySelector('p')?.textContent.toLowerCase() || '';
      const match = !query || nom.includes(query) || desc.includes(query);
      card.style.display = match ? '' : 'none';
    });
  }, 250));
}

// ============================================================
// PANIER — GESTION LOCALSTORAGE
// ============================================================

function getPanier() {
  return storage.get(STORAGE_KEYS.panier) || [];
}

function savePanier(panier) {
  storage.set(STORAGE_KEYS.panier, panier);
  updateBadgePanier();
}

function ajouterAuPanier(produit) {
  const panier = getPanier();
  const existant = panier.find(item => item.id === produit.id);

  if (existant) {
    existant.quantite += 1;
  } else {
    panier.push({ ...produit, quantite: 1 });
  }

  savePanier(panier);
  showToast(`${produit.nom} ajouté au panier 🛒`, 'success');
  // ICI FUTURE API PHP : POST /api/panier/ajouter
}

function supprimerDuPanier(id) {
  const panier = getPanier().filter(item => item.id !== id);
  savePanier(panier);
  showToast('Article retiré du panier', 'info');
}

function changerQuantite(id, delta) {
  const panier = getPanier();
  const item = panier.find(i => i.id === id);
  if (!item) return;

  item.quantite += delta;
  if (item.quantite <= 0) {
    supprimerDuPanier(id);
    return;
  }
  savePanier(panier);
}

function calculerSousTotal() {
  return getPanier().reduce((acc, item) => acc + item.prix * item.quantite, 0);
}

function calculerTotal() {
  const sousTotal = calculerSousTotal();
  const frais = sousTotal > 0 ? FRAIS_SERVICE : 0;
  return sousTotal + frais;
}

// ============================================================
// BOUTONS "AJOUTER AU PANIER" — Page principale
// ============================================================

function initBoutonsAjoutPanier() {
  // Spécialités
  $$('.card').forEach((card, index) => {
    const btn = card.querySelector('.add-cart button');
    if (!btn) return;

    const nom = card.querySelector('h3')?.textContent.trim() || `Plat ${index + 1}`;
    const prixText = card.querySelector('.price')?.textContent || '0';
    const prix = parseInt(prixText.replace(/[^\d]/g, '')) || 0;
    const image = card.querySelector('img')?.src || '';
    const id = `spec-${index}`;

    btn.addEventListener('click', () => {
      ajouterAuPanier({ id, nom, prix, image, categorie: 'specialites' });
      animerBoutonPanier(btn);
    });
  });

  // Menu complet
  $$('.mcard').forEach((card, index) => {
    const btn = card.querySelector('.add-cart button');
    if (!btn) return;

    const nom = card.querySelector('h3')?.textContent.trim() || `Plat ${index + 1}`;
    const prixText = card.querySelector('.mprice')?.textContent || '0';
    const prix = parseInt(prixText.replace(/[^\d]/g, '')) || 0;
    const image = card.querySelector('img')?.src || '';
    const categorie = card.dataset.category || 'divers';
    const id = `menu-${index}`;

    btn.addEventListener('click', () => {
      ajouterAuPanier({ id, nom, prix, image, categorie });
      animerBoutonPanier(btn);
    });
  });
}

function animerBoutonPanier(btn) {
  btn.classList.add('btn-ajout-anim');
  const original = btn.innerHTML;
  btn.textContent = '✓ Ajouté !';
  setTimeout(() => {
    btn.innerHTML = original;
    btn.classList.remove('btn-ajout-anim');
  }, 1200);
}

// ============================================================
// PAGE COMMANDE — Rendu dynamique du panier
// ============================================================

function initPageCommande() {
  if (!document.querySelector('.cart-container')) return;

  renderPanier();
}

function renderPanier() {
  const panier = getPanier();
  const cartItems = $('.cart-items');
  const cartSummary = $('.cart-summary');
  const btnCommander = $('.btn-main');

  if (!cartItems) return;

  if (panier.length === 0) {
    cartItems.innerHTML = `
      <div class="panier-vide" role="status">
        <div class="panier-vide-icon">🛒</div>
        <h2>Votre panier est vide</h2>
        <p>Ajoutez des plats depuis notre menu pour commencer votre commande.</p>
        <a href="AU MBOA🇨🇲.html#menu" class="btn-vers-menu">Voir le menu →</a>
      </div>
    `;
    if (btnCommander) {
      btnCommander.disabled = true;
      btnCommander.style.opacity = '0.5';
      btnCommander.style.cursor = 'not-allowed';
    }
    updateResume(0, 0, 0);
    return;
  }

  cartItems.innerHTML = panier.map(item => `
    <div class="cart-item" data-id="${item.id}" role="listitem">
      <img src="${item.image}" alt="${item.nom}" onerror="this.src='image/img3.jpg'">
      <div class="details">
        <h3>${item.nom}</h3>
        <p>${item.categorie || ''}</p>
        <span>${formatPrix(item.prix)}</span>
      </div>
      <div class="actions">
        <button class="delete" aria-label="Supprimer ${item.nom}" data-id="${item.id}">🗑</button>
        <div class="qty" role="group" aria-label="Quantité de ${item.nom}">
          <button aria-label="Diminuer" data-id="${item.id}" data-delta="-1">-</button>
          <span aria-live="polite">${item.quantite}</span>
          <button aria-label="Augmenter" data-id="${item.id}" data-delta="1">+</button>
        </div>
      </div>
    </div>
  `).join('');

  // Événements suppression
  $$('.delete', cartItems).forEach(btn => {
    btn.addEventListener('click', () => {
      supprimerDuPanier(btn.dataset.id);
      renderPanier();
    });
  });

  // Événements quantité
  $$('.qty button', cartItems).forEach(btn => {
    btn.addEventListener('click', () => {
      changerQuantite(btn.dataset.id, parseInt(btn.dataset.delta));
      renderPanier();
    });
  });

  const sousTotal = calculerSousTotal();
  const frais = FRAIS_SERVICE;
  const total = sousTotal + frais;
  updateResume(sousTotal, frais, total);

  if (btnCommander) {
    btnCommander.disabled = false;
    btnCommander.style.opacity = '1';
    btnCommander.style.cursor = 'pointer';
  }

  // Message livraison gratuite
  const cartFree = $('.cart-free');
  if (cartFree) {
    if (sousTotal >= LIVRAISON_GRATUITE_SEUIL) {
      cartFree.innerHTML = '<p>🎉 Vous bénéficiez de la livraison gratuite !</p>';
      cartFree.style.color = '#4caf50';
    } else {
      const reste = LIVRAISON_GRATUITE_SEUIL - sousTotal;
      cartFree.innerHTML = `<p>Plus que ${formatPrix(reste)} pour la livraison gratuite 🚀</p>`;
      cartFree.style.color = '';
    }
  }
}

function updateResume(sousTotal, frais, total) {
  const lines = $$('.line span:last-child, .line .line-span');
  const totalEl = $('.total-number, .total-span');

  $$('.line').forEach((line, i) => {
    const valEl = line.querySelector('span:last-child');
    if (!valEl) return;
    if (i === 0) valEl.textContent = formatPrix(sousTotal);
    if (i === 1) valEl.textContent = formatPrix(frais);
  });

  if (totalEl) totalEl.textContent = formatPrix(total);
}

// ============================================================
// PAGE LIVRAISON — Validation + Commande
// ============================================================

function initPageLivraison() {
  const form = $('form', $('.delivery-container'));
  if (!form) return;

  // Synchroniser le résumé
  syncResumeLivraison();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validerFormulaireLivraison()) {
      confirmerCommande();
    }
  });

  // Validation en temps réel
  $$('input', form).forEach(input => {
    input.addEventListener('blur', () => validerChamp(input));
    input.addEventListener('input', () => {
      input.classList.remove('champ-erreur');
      const errEl = input.nextElementSibling;
      if (errEl?.classList.contains('msg-erreur')) errEl.remove();
    });
  });
}

function syncResumeLivraison() {
  const sousTotal = calculerSousTotal();
  const frais = sousTotal > 0 ? FRAIS_SERVICE : 0;
  const total = sousTotal + frais;
  updateResume(sousTotal, frais, total);
}

function validerChamp(input) {
  let erreur = null;
  const val = input.value.trim();

  if (input.type === 'tel' && val && !validerTelephoneCM(val)) {
    erreur = 'Numéro de téléphone camerounais invalide (ex: +237 6XX XX XX XX)';
  } else if (input.required && !val) {
    erreur = 'Ce champ est obligatoire';
  }

  afficherErreurChamp(input, erreur);
  return !erreur;
}

function afficherErreurChamp(input, message) {
  const existant = input.nextElementSibling;
  if (existant?.classList.contains('msg-erreur')) existant.remove();

  if (message) {
    input.classList.add('champ-erreur');
    const msg = document.createElement('p');
    msg.className = 'msg-erreur';
    msg.textContent = message;
    msg.setAttribute('role', 'alert');
    input.after(msg);
  } else {
    input.classList.remove('champ-erreur');
    input.classList.add('champ-ok');
  }
}

function validerFormulaireLivraison() {
  let valide = true;

  $$('input[required]').forEach(input => {
    if (!validerChamp(input)) valide = false;
  });

  const paiementChoisi = $('input[name="paiement"]:checked');
  if (!paiementChoisi) {
    showToast('Veuillez choisir un mode de paiement', 'error');
    valide = false;
  }

  return valide;
}

function confirmerCommande() {
  const panier = getPanier();
  if (!panier.length) {
    showToast('Votre panier est vide !', 'error');
    return;
  }

  const numeroCommande = genererIdCommande();
  const commande = {
    id: numeroCommande,
    date: new Date().toISOString(),
    articles: panier,
    sousTotal: calculerSousTotal(),
    fraisService: FRAIS_SERVICE,
    total: calculerTotal(),
    livraison: {
      nom: $('input[type="text"]')?.value || '',
      telephone: $('input[type="tel"]')?.value || '',
      adresse: $$('input[type="text"]')[1]?.value || '',
      quartier: $('input[list="quartiers"]')?.value || '',
    },
    paiement: $('input[name="paiement"]:checked')?.nextElementSibling?.querySelector('strong')?.textContent || '',
    statut: 'en_attente',
  };

  // Sauvegarder
  const historique = storage.get(STORAGE_KEYS.commandes) || [];
  historique.push(commande);
  storage.set(STORAGE_KEYS.commandes, historique);

  // Vider panier
  savePanier([]);

  // ICI FUTURE API PHP : POST /api/commandes/creer
  // fetch('/api/commandes/creer', { method: 'POST', body: JSON.stringify(commande), headers: {'Content-Type':'application/json'} });

  afficherPopupSucces(numeroCommande);
}

function afficherPopupSucces(numeroCommande) {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup-commande" role="dialog" aria-modal="true" aria-label="Commande confirmée">
      <div class="popup-icon">🎉</div>
      <h2>Commande confirmée !</h2>
      <p>Votre numéro de commande :</p>
      <div class="popup-numero">${numeroCommande}</div>
      <p class="popup-eta">⏱ Livraison estimée : <strong>30–45 minutes</strong></p>
      <p class="popup-contact">Notre équipe vous contactera au numéro fourni.</p>
      <button class="popup-btn" onclick="window.location.href='AU MBOA🇨🇲.html'">Retour à l'accueil</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('popup-visible'));
}

// ============================================================
// RÉSERVATION
// ============================================================

function initReservation() {
  const form = $('#reservationForm');
  if (!form) return;

  // Empêcher dates passées
  const inputDate = form.querySelector('input[type="date"]');
  if (inputDate) {
    const today = new Date().toISOString().split('T')[0];
    inputDate.min = today;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validerReservation(form)) {
      const reservation = {
        id: `RES-${Date.now()}`,
        date: new Date().toISOString(),
        nom: form.querySelector('input[type="text"]')?.value || '',
        telephone: form.querySelector('input[type="tel"]')?.value || '',
        dateResa: inputDate?.value || '',
        heure: form.querySelector('input[type="time"]')?.value || '',
        personnes: form.querySelector('input[type="number"]')?.value || '',
        commentaires: form.querySelector('textarea')?.value || '',
      };

      const reservations = storage.get(STORAGE_KEYS.reservations) || [];
      reservations.push(reservation);
      storage.set(STORAGE_KEYS.reservations, reservations);

      // ICI FUTURE API PHP : POST /api/reservations/creer
      showToast('Réservation confirmée ! Nous vous contacterons bientôt. 🍽️', 'success', 5000);
      form.reset();
      if (inputDate) inputDate.min = new Date().toISOString().split('T')[0];
    }
  });
}

function validerReservation(form) {
  let valide = true;

  const tel = form.querySelector('input[type="tel"]');
  if (tel && !validerTelephoneCM(tel.value)) {
    showToast('Numéro de téléphone invalide', 'error');
    tel.classList.add('champ-erreur');
    valide = false;
  }

  const heure = form.querySelector('input[type="time"]')?.value;
  if (heure) {
    const [h] = heure.split(':').map(Number);
    if (h < 11 || h >= 23) {
      showToast('Nous sommes ouverts de 11h à 23h', 'error');
      valide = false;
    }
  }

  return valide;
}

// ============================================================
// AUTHENTIFICATION FRONTEND SIMULÉE
// ============================================================

function getUtilisateur() {
  return storage.get(STORAGE_KEYS.utilisateur);
}

function connecterUtilisateur(utilisateur) {
  storage.set(STORAGE_KEYS.utilisateur, utilisateur);
  updateNavbarAuth();
  // ICI FUTURE API PHP : POST /api/auth/connexion
}

function deconnecterUtilisateur() {
  storage.remove(STORAGE_KEYS.utilisateur);
  updateNavbarAuth();
  showToast('Vous êtes déconnecté(e)', 'info');
  // ICI FUTURE API PHP : POST /api/auth/deconnexion
}

function updateNavbarAuth() {
  const utilisateur = getUtilisateur();
  const profilLinks = $$('.nav-links a[href*="connexion"]');

  profilLinks.forEach(link => {
    if (utilisateur) {
      link.title = `Connecté : ${utilisateur.prenom || utilisateur.email}`;
      const img = link.querySelector('img');
      if (img) img.style.filter = 'sepia(1) hue-rotate(30deg) brightness(1.2)';
    }
  });

  // Bouton déconnexion si déjà connecté
  const existDecoBtn = $('#btn-deconnexion');
  if (utilisateur && !existDecoBtn) {
    const navLinks = $('.nav-links');
    if (navLinks) {
      const li = document.createElement('li');
      li.innerHTML = `<button id="btn-deconnexion" aria-label="Se déconnecter" title="Se déconnecter (${utilisateur.prenom || utilisateur.email})">👤 Déconnexion</button>`;
      navLinks.appendChild(li);
      li.querySelector('button').addEventListener('click', deconnecterUtilisateur);
    }
  } else if (!utilisateur && existDecoBtn) {
    existDecoBtn.closest('li')?.remove();
  }
}

// Formulaire connexion.html
function initFormulaireConnexion() {
  const form = $('#form-connexion');
  if (!form) return;

  // Afficher/masquer mot de passe
  $$('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#email-connexion')?.value.trim();
    const mdp = $('#mdp-connexion')?.value;
    const remember = $('#remember-me')?.checked;

    if (!validerEmail(email)) {
      showToast('Email invalide', 'error');
      return;
    }

    // Vérifier utilisateurs inscrits
    const inscrits = storage.get('aumboa_inscrits') || [];
    const trouve = inscrits.find(u => u.email === email && u.mdp === btoa(mdp));

    // ICI FUTURE API PHP : POST /api/auth/connexion { email, mdp }
    if (trouve || (email && mdp)) { // simulation : accepter tout si inscrit ou pour démo
      const user = trouve || { email, prenom: email.split('@')[0], role: 'client' };
      connecterUtilisateur(user);
      if (remember) storage.set('aumboa_remember', email);
      showToast(`Bienvenue ${user.prenom || ''} ! 👋`, 'success');
      setTimeout(() => window.location.href = 'AU MBOA🇨🇲.html', 1200);
    } else {
      showToast('Email ou mot de passe incorrect', 'error');
    }
  });

  // Remember me
  const savedEmail = storage.get('aumboa_remember');
  if (savedEmail) {
    const emailInput = $('#email-connexion');
    if (emailInput) emailInput.value = savedEmail;
    const rememberInput = $('#remember-me');
    if (rememberInput) rememberInput.checked = true;
  }
}

// Formulaire inscription.html
function initFormulaireInscription() {
  const form = $('#form-inscription');
  if (!form) return;

  $$('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  const mdpInput = $('#mdp-inscription');
  if (mdpInput) {
    mdpInput.addEventListener('input', () => afficherForceMdp(mdpInput.value));
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const prenom = $('#prenom-inscription')?.value.trim();
    const nom = $('#nom-inscription')?.value.trim();
    const email = $('#email-inscription')?.value.trim();
    const tel = $('#tel-inscription')?.value.trim();
    const mdp = $('#mdp-inscription')?.value;
    const mdpConfirm = $('#mdp-confirm')?.value;

    if (!validerEmail(email)) { showToast('Email invalide', 'error'); return; }
    if (tel && !validerTelephoneCM(tel)) { showToast('Numéro de téléphone invalide', 'error'); return; }
    if (mdp.length < 8) { showToast('Le mot de passe doit comporter au moins 8 caractères', 'error'); return; }
    if (mdp !== mdpConfirm) { showToast('Les mots de passe ne correspondent pas', 'error'); return; }

    const inscrits = storage.get('aumboa_inscrits') || [];
    if (inscrits.find(u => u.email === email)) {
      showToast('Un compte existe déjà avec cet email', 'warning');
      return;
    }

    const nouvelUtilisateur = {
      id: `USR-${Date.now()}`,
      prenom, nom, email,
      telephone: tel,
      mdp: btoa(mdp), // encodage basique — backend utilisera bcrypt
      dateInscription: new Date().toISOString(),
      role: 'client',
    };

    inscrits.push(nouvelUtilisateur);
    storage.set('aumboa_inscrits', inscrits);

    // ICI FUTURE API PHP : POST /api/auth/inscription
    connecterUtilisateur(nouvelUtilisateur);
    showToast(`Bienvenue ${prenom} ! Compte créé avec succès 🎉`, 'success');
    setTimeout(() => window.location.href = 'AU MBOA🇨🇲.html', 1500);
  });
}

function afficherForceMdp(mdp) {
  let indicateur = $('#force-mdp');
  if (!indicateur) {
    indicateur = document.createElement('div');
    indicateur.id = 'force-mdp';
    $('#mdp-inscription')?.after(indicateur);
  }

  let force = 0;
  if (mdp.length >= 8) force++;
  if (/[A-Z]/.test(mdp)) force++;
  if (/[0-9]/.test(mdp)) force++;
  if (/[^A-Za-z0-9]/.test(mdp)) force++;

  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
  const classes = ['', 'mdp-faible', 'mdp-moyen', 'mdp-bon', 'mdp-fort'];
  indicateur.textContent = mdp ? `Force : ${labels[force]}` : '';
  indicateur.className = classes[force] || '';
}

// ============================================================
// ANIMATIONS — IntersectionObserver
// ============================================================

function initAnimations() {
  const elements = $$('.card, .mcard, .test-card, .about-container, .reservation-container, .local, .liv-container');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  elements.forEach((el, i) => {
    el.classList.add('reveal-hidden');
    el.style.transitionDelay = `${(i % 3) * 0.1}s`;
    observer.observe(el);
  });

  // Bouton retour en haut
  initRetourHaut();

  // Compteur animé About
  initCompteurs();
}

function initRetourHaut() {
  const btn = document.createElement('button');
  btn.id = 'retour-haut';
  btn.setAttribute('aria-label', 'Retour en haut');
  btn.innerHTML = '↑';
  document.body.appendChild(btn);

  window.addEventListener('scroll', debounce(() => {
    btn.classList.toggle('retour-haut-visible', window.scrollY > 400);
  }, 100));

  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initCompteurs() {
  const badge = $('.badge h3');
  if (!badge) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animerCompteur(badge, 0, 15, 1200);
        observer.unobserve(entry.target);
      }
    });
  });
  observer.observe(badge);
}

function animerCompteur(el, debut, fin, duree) {
  const startTime = performance.now();
  const update = (now) => {
    const progress = Math.min((now - startTime) / duree, 1);
    el.textContent = `${Math.round(debut + (fin - debut) * progress)}+`;
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ============================================================
// FAVORIS
// ============================================================

function initFavoris() {
  $$('.mcard, .card').forEach((card, index) => {
    const img = card.querySelector('.mcard-image, .card-image');
    if (!img) return;

    const btn = document.createElement('button');
    btn.className = 'btn-favori';
    btn.setAttribute('aria-label', 'Ajouter aux favoris');
    const id = `fav-${index}`;
    btn.dataset.id = id;

    const favoris = storage.get(STORAGE_KEYS.favoris) || [];
    btn.classList.toggle('favori-actif', favoris.includes(id));
    btn.textContent = favoris.includes(id) ? '❤️' : '🤍';
    img.style.position = 'relative';
    img.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const favs = storage.get(STORAGE_KEYS.favoris) || [];
      const idx = favs.indexOf(id);
      if (idx === -1) {
        favs.push(id);
        btn.textContent = '❤️';
        btn.classList.add('favori-actif');
        showToast('Ajouté aux favoris ❤️', 'info', 2000);
      } else {
        favs.splice(idx, 1);
        btn.textContent = '🤍';
        btn.classList.remove('favori-actif');
      }
      storage.set(STORAGE_KEYS.favoris, favs);
    });
  });
}

// ============================================================
// CSS DYNAMIQUE — Injecter les styles nécessaires
// ============================================================

function injecterStylesDynamiques() {
  const style = document.createElement('style');
  style.textContent = `
    /* LOADER */
    #aumboa-loader {
      position: fixed; inset: 0; z-index: 9999;
      background: #5c3b1e;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.6s ease;
    }
    #aumboa-loader.loader-hide { opacity: 0; pointer-events: none; }
    .loader-inner { text-align: center; color: white; }
    .loader-logo { font-size: 60px; animation: pulse 1s infinite; }
    .loader-text { font-family: 'Playfair Display', serif; font-size: 28px; margin: 10px 0; color: #d4af37; }
    .loader-bar { width: 200px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 99px; margin: 15px auto 0; overflow: hidden; }
    .loader-progress { height: 100%; background: #d4af37; animation: loading 0.8s ease forwards; }
    @keyframes loading { from { width: 0 } to { width: 100% } }
    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }

    /* DARK MODE */
    [data-theme="dark"] body { background: #1a1208 !important; color: #f4e7d3; }
    [data-theme="dark"] .navbar { background: rgba(15,10,5,0.85) !important; }
    [data-theme="dark"] .cart-item, [data-theme="dark"] .mcard, [data-theme="dark"] .card { background: #2d1f10 !important; }
    [data-theme="dark"] .liv-container { background: #2d1f10 !important; color: #f4e7d3; }
    [data-theme="dark"] .liv-container input { background: #1a1208; color: #f4e7d3; border-color: #5c3b1e; }
    [data-theme="dark"] .test-card { background: #2d1f10 !important; color: #f4e7d3; }

    /* DARK MODE TOGGLE */
    #theme-toggle {
      position: fixed; bottom: 80px; right: 20px; z-index: 999;
      width: 46px; height: 46px; border-radius: 50%; border: none;
      background: #d4af37; font-size: 20px; cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      transition: transform 0.2s;
    }
    #theme-toggle:hover { transform: scale(1.1); }

    /* RETOUR HAUT */
    #retour-haut {
      position: fixed; bottom: 20px; right: 20px; z-index: 999;
      width: 46px; height: 46px; border-radius: 50%; border: none;
      background: #5c3b1e; color: white; font-size: 20px; cursor: pointer;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s, transform 0.2s;
    }
    #retour-haut.retour-haut-visible { opacity: 1; pointer-events: all; }
    #retour-haut:hover { transform: translateY(-3px); }

    /* TOAST */
    #toast-container {
      position: fixed; top: 80px; right: 20px; z-index: 9998;
      display: flex; flex-direction: column; gap: 10px;
      max-width: 320px;
    }
    .toast {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 18px; border-radius: 12px;
      background: white; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      font-size: 14px; font-weight: 500;
      transform: translateX(120%); transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
    }
    .toast.toast-visible { transform: translateX(0); }
    .toast-success { border-left: 4px solid #4caf50; }
    .toast-error { border-left: 4px solid #f44336; }
    .toast-info { border-left: 4px solid #2196f3; }
    .toast-warning { border-left: 4px solid #ff9800; }
    .toast-icon { font-size: 18px; }

    /* NAVBAR SCROLLED */
    .navbar.scrolled { background: rgba(30,15,5,0.95) !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    .nav-links a.active-link { color: #d4af37 !important; }
    .nav-links a.active-link::after { content: ''; display: block; height: 2px; background: #d4af37; border-radius: 2px; margin-top: 2px; }

    /* HAMBURGER */
    .hamburger {
      display: none; flex-direction: column; gap: 5px;
      background: none; border: none; cursor: pointer; padding: 5px;
    }
    .hamburger span { display: block; width: 25px; height: 2px; background: white; transition: 0.3s; border-radius: 2px; }
    .hamburger-active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
    .hamburger-active span:nth-child(2) { opacity: 0; }
    .hamburger-active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

    @media (max-width: 768px) {
      .hamburger { display: flex; }
      .nav-links {
        display: none; flex-direction: column;
        position: absolute; top: 100%; left: 0; right: 0;
        background: rgba(30,15,5,0.97); padding: 20px; gap: 15px;
      }
      .nav-links.nav-open { display: flex; }
    }

    /* BADGE PANIER */
    .badge-panier {
      position: absolute; top: -8px; right: -8px;
      background: #d4af37; color: #5c3b1e;
      font-size: 10px; font-weight: 700;
      width: 18px; height: 18px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
    }

    /* ANIMATIONS REVEAL */
    .reveal-hidden { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .revealed { opacity: 1 !important; transform: translateY(0) !important; }

    /* PANIER VIDE */
    .panier-vide { text-align: center; padding: 60px 20px; color: #5c3b1e; }
    .panier-vide-icon { font-size: 70px; margin-bottom: 20px; }
    .panier-vide h2 { font-family: 'Playfair Display', serif; font-size: 32px; margin-bottom: 10px; }
    .panier-vide p { color: #888; margin-bottom: 25px; }
    .btn-vers-menu { display: inline-block; padding: 12px 28px; background: #d4af37; color: white; border-radius: 30px; text-decoration: none; font-weight: 600; transition: 0.3s; }
    .btn-vers-menu:hover { background: #b8962f; }

    /* VALIDATION */
    .champ-erreur { border-color: #f44336 !important; }
    .champ-ok { border-color: #4caf50 !important; }
    .msg-erreur { color: #f44336; font-size: 12px; margin: -10px 0 10px; }

    /* POPUP COMMANDE */
    .popup-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.4s;
    }
    .popup-overlay.popup-visible { opacity: 1; }
    .popup-commande {
      background: white; border-radius: 25px; padding: 50px 40px;
      text-align: center; max-width: 450px; width: 90%;
      transform: scale(0.8); transition: transform 0.4s cubic-bezier(.34,1.56,.64,1);
    }
    .popup-overlay.popup-visible .popup-commande { transform: scale(1); }
    .popup-icon { font-size: 60px; margin-bottom: 15px; }
    .popup-commande h2 { font-family: 'Playfair Display', serif; color: #5c3b1e; font-size: 28px; margin-bottom: 10px; }
    .popup-numero { background: #f4e7d3; color: #5c3b1e; font-weight: 700; font-size: 20px; padding: 12px 24px; border-radius: 10px; margin: 15px 0; letter-spacing: 1px; }
    .popup-eta { color: #555; margin: 10px 0; }
    .popup-contact { color: #888; font-size: 13px; margin-bottom: 25px; }
    .popup-btn { background: #d4af37; color: white; border: none; padding: 14px 35px; border-radius: 30px; font-weight: 700; font-size: 16px; cursor: pointer; transition: 0.3s; }
    .popup-btn:hover { background: #b8962f; }

    /* FORCE MOT DE PASSE */
    #force-mdp { font-size: 12px; margin: -5px 0 10px; font-weight: 600; }
    .mdp-faible { color: #f44336; }
    .mdp-moyen { color: #ff9800; }
    .mdp-bon { color: #8bc34a; }
    .mdp-fort { color: #4caf50; }

    /* RECHERCHE MENU */
    .menu-search { margin-top: 20px; }
    #recherche-menu {
      width: 100%; max-width: 400px; padding: 12px 20px;
      border-radius: 30px; border: 2px solid #d4af37;
      font-size: 16px; outline: none; background: white;
      transition: box-shadow 0.2s;
    }
    #recherche-menu:focus { box-shadow: 0 0 0 3px rgba(212,175,55,0.3); }

    /* FAVORIS */
    .btn-favori {
      position: absolute; top: 10px; left: 10px;
      background: rgba(255,255,255,0.85); border: none;
      border-radius: 50%; width: 36px; height: 36px;
      font-size: 16px; cursor: pointer; transition: transform 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-favori:hover { transform: scale(1.2); }
    .btn-favori.favori-actif { background: rgba(255,240,240,0.95); }

    /* BTN AJOUT ANIMATION */
    .btn-ajout-anim { background: #4caf50 !important; transform: scale(0.95); }

    /* DÉCONNEXION */
    #btn-deconnexion {
      background: none; border: 1px solid rgba(255,255,255,0.4);
      color: white; padding: 6px 14px; border-radius: 20px;
      cursor: pointer; font-size: 14px; transition: 0.3s;
    }
    #btn-deconnexion:hover { background: rgba(255,255,255,0.15); }
  `;
  document.head.appendChild(style);
}

// ============================================================
// INITIALISATION
// ============================================================

function init() {
  injecterStylesDynamiques();
  initNotifications();
  initLoader();
  initDarkMode();

  document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initMenuFilter();
    initBoutonsAjoutPanier();
    initPageCommande();
    initPageLivraison();
    initReservation();
    initFormulaireConnexion();
    initFormulaireInscription();
    initAnimations();
    initFavoris();
  });
}

init();

/**
 * ============================================================
 * ARCHITECTURE FUTURE — PHP/MySQL
 * ============================================================
 *
 * Tables MySQL suggérées :
 *
 * utilisateurs (id, prenom, nom, email, mdp_hash, telephone, role, created_at)
 * plats (id, nom, description, prix, image, categorie, disponible)
 * commandes (id, utilisateur_id, total, statut, adresse, quartier, paiement, created_at)
 * commande_items (id, commande_id, plat_id, quantite, prix_unitaire)
 * reservations (id, utilisateur_id, nom, telephone, date_resa, heure, personnes, commentaires)
 *
 * Endpoints REST PHP :
 * POST /api/auth/inscription
 * POST /api/auth/connexion
 * POST /api/auth/deconnexion
 * GET  /api/plats?categorie=trad
 * POST /api/commandes/creer
 * GET  /api/commandes/:id
 * POST /api/reservations/creer
 * GET  /api/reservations/:id
 */
