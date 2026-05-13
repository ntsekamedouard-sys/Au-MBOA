/**
 * ============================================================
 *  PANIER.JS — Au MBOA 🇨🇲
 *  Moteur central du panier de commande
 *
 *  Responsabilités :
 *  - CRUD localStorage (ajouter, supprimer, modifier quantité)
 *  - Rendu dynamique complet de commande.html
 *  - Calcul sous-total / frais / total
 *  - Mise à jour badge panier dans la navbar
 *  - Notifications toast
 *  - Popup de confirmation commande
 *  - Export window.Panier pour livraison.js et AU MBOA🇨🇲.js
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
    CONSTANTES
───────────────────────────────────────────── */
const PANIER_KEY    = 'aumboa_panier';
const COMMANDES_KEY = 'aumboa_commandes';
const FRAIS_SERVICE = 500;
const SEUIL_GRATUIT = 10000;

/* ─────────────────────────────────────────────
    UTILITAIRES
───────────────────────────────────────────── */
function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
}
function storageSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.warn('[Au MBOA] storage:', e); }
}

function formatPrix(montant) {
    return montant.toLocaleString('fr-FR') + ' FCFA';
}

function genererIdCommande() {
    const ts  = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    return 'MBOA-' + ts + '-' + rnd;
}

/* ═══════════════════════════════════════════════
    1. CRUD PANIER
═══════════════════════════════════════════════ */

function getPanier() {
    return storageGet(PANIER_KEY) || [];
}

function _savePanier(panier) {
    storageSet(PANIER_KEY, panier);
    _updateBadgeNavbar(panier);
}

function ajouterArticle(produit) {
    const panier   = getPanier();
    const existant = panier.find(function(item) { return item.id === produit.id; });

    if (existant) {
        existant.quantite += 1;
    } else {
        panier.push({
            id:        produit.id,
            nom:       produit.nom,
            prix:      produit.prix,
            image:     produit.image || 'image/img3.jpg',
            categorie: produit.categorie || '',
            quantite:  1,
        });
    }

    _savePanier(panier);
    afficherToast('&#x2705; <strong>' + produit.nom + '</strong> ajouté au panier', 'success');
    // ICI FUTURE API PHP → POST /api/panier/ajouter
}

function supprimerArticle(id) {
    const panier = getPanier().filter(function(item) { return item.id !== id; });
    _savePanier(panier);
    afficherToast('Article retiré du panier', 'info');
    // ICI FUTURE API PHP → DELETE /api/panier/{id}
}

function changerQuantite(id, delta) {
    const panier = getPanier();
    const item   = panier.find(function(i) { return i.id === id; });
    if (!item) return;

    item.quantite += delta;

    if (item.quantite <= 0) {
        supprimerArticle(id);
        return;
    }
    _savePanier(panier);
}

function viderPanier() {
    _savePanier([]);
}

/* ─────────────────────────────────────────────
    CALCULS
───────────────────────────────────────────── */
function calculerSousTotal() {
    return getPanier().reduce(function(acc, item) {
        return acc + item.prix * item.quantite;
    }, 0);
}

function calculerFrais(sousTotal) {
    return sousTotal > 0 ? FRAIS_SERVICE : 0;
}

function calculerTotal() {
    var st = calculerSousTotal();
    return st + calculerFrais(st);
}

function compterArticles() {
    return getPanier().reduce(function(acc, item) {
        return acc + item.quantite;
    }, 0);
}

/* ═══════════════════════════════════════════════
    2. BADGE NAVBAR
═══════════════════════════════════════════════ */
function _updateBadgeNavbar(panier) {
    var items = panier || getPanier();
    var total = items.reduce(function(acc, i) { return acc + i.quantite; }, 0);

    document.querySelectorAll('.badge-panier-nav').forEach(function(b) { b.remove(); });
    if (total === 0) return;

    document.querySelectorAll('.nav-links a[href*="commande"]').forEach(function(link) {
        var badge = document.createElement('span');
        badge.className = 'badge-panier-nav';
        badge.textContent = total > 9 ? '9+' : String(total);
        badge.setAttribute('aria-label', total + ' article' + (total > 1 ? 's' : '') + ' dans le panier');
        link.style.position = 'relative';
        link.appendChild(badge);
    });
}

/* ═══════════════════════════════════════════════
    3. TOAST
═══════════════════════════════════════════════ */
function afficherToast(message, type, duree) {
    type  = type  || 'success';
    duree = duree || 3500;

    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }

    var icones = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    var toast  = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span class="toast-icon">' + (icones[type] || 'ℹ️') + '</span>'
                    + '<span class="toast-msg">' + message + '</span>';
    container.appendChild(toast);

    requestAnimationFrame(function() {
        requestAnimationFrame(function() { toast.classList.add('toast-visible'); });
    });

    setTimeout(function() {
        toast.classList.remove('toast-visible');
        setTimeout(function() { toast.remove(); }, 400);
    }, duree);
}

/* ═══════════════════════════════════════════════
    4. RENDU PAGE COMMANDE
═══════════════════════════════════════════════ */
function _renderPageCommande() {
    var zone = document.getElementById('cart-items-zone');
    if (!zone) return;

    var panier = getPanier();
    panier.length === 0 ? _renderPanierVide(zone) : _renderArticles(zone, panier);

    _renderResume();
    _renderBoutonCommander();
    _renderMessageLivraison();
}

function _renderPanierVide(zone) {
    zone.innerHTML = [
        '<div class="panier-vide" role="status" aria-label="Panier vide">',
        '  <span class="panier-vide-icon">🛒</span>',
        '  <h2>Votre panier est vide</h2>',
        '  <p>Ajoutez des plats depuis notre menu pour commencer votre commande.</p>',
        '  <a href="AU MBOA\uD83C\uDDE8\uD83C\uDDF2.html#menu" class="btn-vers-menu">Découvrir le menu →</a>',
        '</div>',
    ].join('');
}

function _renderArticles(zone, panier) {
    zone.innerHTML = panier.map(function(item) {
        return [
            '<div class="cart-item" data-id="' + item.id + '" role="listitem">',
            '  <img src="' + item.image + '" alt="' + item.nom + '" onerror="this.src=\'image/img3.jpg\'">',
            '  <div class="details">',
            '    <h3>' + item.nom + '</h3>',
            '    <p>' + item.categorie + '</p>',
            '    <span>' + formatPrix(item.prix) + '</span>',
            '  </div>',
            '  <div class="actions">',
            '    <button class="delete" data-id="' + item.id + '" aria-label="Supprimer ' + item.nom + '">🗑</button>',
            '    <div class="qty" role="group" aria-label="Quantité de ' + item.nom + '">',
            '      <button class="qty-btn" data-id="' + item.id + '" data-delta="-1" aria-label="Diminuer">−</button>',
            '      <span aria-live="polite">' + item.quantite + '</span>',
            '      <button class="qty-btn" data-id="' + item.id + '" data-delta="1" aria-label="Augmenter">+</button>',
            '    </div>',
            '  </div>',
            '</div>',
        ].join('');
    }).join('');

    // Délégation : un seul listener sur le conteneur
    zone.addEventListener('click', _handleCartClick);
}

function _handleCartClick(e) {
    // Supprimer
    var deleteBtn = e.target.closest('.delete');
    if (deleteBtn) {
        supprimerArticle(deleteBtn.dataset.id);
        _renderPageCommande();
        return;
    }
    // Quantité
    var qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
        changerQuantite(qtyBtn.dataset.id, parseInt(qtyBtn.dataset.delta, 10));
        _renderPageCommande();
    }
}

function _renderResume() {
    var st    = calculerSousTotal();
    var frais = calculerFrais(st);
    var tot   = st + frais;

    var elSt    = document.getElementById('resume-sous-total');
    var elFrais = document.getElementById('resume-frais');
    var elTot   = document.getElementById('resume-total');

    if (elSt)    elSt.textContent    = formatPrix(st);
    if (elFrais) elFrais.textContent = formatPrix(frais);
    if (elTot)   elTot.textContent   = formatPrix(tot);
}

function _renderBoutonCommander() {
    var btn   = document.getElementById('btn-passer-commande');
    if (!btn) return;

    var vide  = getPanier().length === 0;
    btn.disabled       = vide;
    btn.style.opacity  = vide ? '0.45' : '1';
    btn.style.cursor   = vide ? 'not-allowed' : 'pointer';

    if (!vide) {
        var newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            window.location.href = 'livraison.html';
        });
    }
}

function _renderMessageLivraison() {
    var zone = document.getElementById('cart-free-msg');
    if (!zone) return;

    var st = calculerSousTotal();

    if (st === 0) {
        zone.innerHTML = '<p>Livraison gratuite à partir de ' + formatPrix(SEUIL_GRATUIT) + '</p>';
        zone.style.color = '';
    } else if (st >= SEUIL_GRATUIT) {
        zone.innerHTML = '<p>🎉 Vous bénéficiez de la <strong>livraison gratuite</strong> !</p>';
        zone.style.color = '#4caf50';
    } else {
        var reste = SEUIL_GRATUIT - st;
        zone.innerHTML = '<p>Plus que <strong>' + formatPrix(reste) + '</strong> pour la livraison gratuite 🚀</p>';
        zone.style.color = '#c9a227';
    }
}

/* ═══════════════════════════════════════════════
    5. POPUP CONFIRMATION
═══════════════════════════════════════════════ */
function afficherPopupCommande(numeroCommande) {
    var overlay = document.getElementById('popup-overlay');
    if (!overlay) return;

    overlay.setAttribute('aria-hidden', 'false');
    overlay.innerHTML = [
        '<div class="popup-commande">',
        '  <div class="popup-icon">🎉</div>',
        '  <h2>Commande confirmée !</h2>',
        '  <p>Votre numéro de commande&nbsp;:</p>',
        '  <div class="popup-numero">' + numeroCommande + '</div>',
        '  <p class="popup-eta">⏱ Livraison estimée&nbsp;: <strong>30–45 minutes</strong></p>',
        '  <p class="popup-contact">Notre équipe vous contactera au numéro fourni.</p>',
        '  <button class="popup-btn" id="popup-retour">Retour à l\'accueil</button>',
        '</div>',
    ].join('');

    requestAnimationFrame(function() {
        requestAnimationFrame(function() { overlay.classList.add('popup-visible'); });
    });

    document.getElementById('popup-retour').addEventListener('click', function() {
        window.location.href = 'AU MBOA\uD83C\uDDE8\uD83C\uDDF2.html';
    });
}

/* ═══════════════════════════════════════════════
    6. STYLES INJECTÉS
═══════════════════════════════════════════════ */
function _injecterStyles() {
    if (document.getElementById('panier-styles')) return;

    var style = document.createElement('style');
    style.id  = 'panier-styles';
    style.textContent = `
        /* BADGE NAVBAR */
        .badge-panier-nav {
            position: absolute; top: -8px; right: -8px;
            background: #d4af37; color: #3b2510;
            font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px; border-radius: 9px;
            padding: 0 4px; display: flex; align-items: center;
            justify-content: center; pointer-events: none;
            box-shadow: 0 1px 4px rgba(0,0,0,0.25);
        }

        /* TOAST */
        #toast-container {
            position: fixed; top: 85px; right: 20px;
            z-index: 9998; display: flex; flex-direction: column;
            gap: 10px; max-width: 320px; pointer-events: none;
        }
        .toast {
            display: flex; align-items: center; gap: 10px;
            padding: 13px 18px; border-radius: 12px;
            background: white; box-shadow: 0 6px 24px rgba(0,0,0,0.14);
            font-size: 14px; font-weight: 500; font-family: 'Poppins', sans-serif;
            transform: translateX(115%);
            transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
            pointer-events: all;
        }
        .toast.toast-visible { transform: translateX(0); }
        .toast-success { border-left: 4px solid #4caf50; }
        .toast-error   { border-left: 4px solid #f44336; }
        .toast-info    { border-left: 4px solid #2196f3; }
        .toast-warning { border-left: 4px solid #ff9800; }
        .toast-icon    { font-size: 18px; flex-shrink: 0; }

        /* PANIER VIDE */
        .panier-vide {
            text-align: center; padding: 70px 30px;
            color: #5c3b1e; animation: fadeSlideUp 0.4s ease;
        }
        .panier-vide-icon {
            font-size: 80px; margin-bottom: 20px; display: block;
        }
        .panier-vide h2 {
            font-family: 'Playfair Display', serif;
            font-size: 30px; margin-bottom: 10px;
        }
        .panier-vide p { color: #888; font-size: 15px; margin-bottom: 28px; }
        .btn-vers-menu {
            display: inline-block; padding: 13px 30px;
            background: #d4af37; color: white; border-radius: 30px;
            text-decoration: none; font-weight: 600; font-size: 15px;
            transition: background 0.25s, transform 0.2s;
        }
        .btn-vers-menu:hover { background: #b8962f; transform: translateY(-2px); }

        /* ANIMATION ARTICLES */
        .cart-item { animation: fadeSlideUp 0.3s ease; }
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* POPUP */
        .popup-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none; transition: opacity 0.35s ease;
        }
        .popup-overlay.popup-visible { opacity: 1; pointer-events: all; }
        .popup-commande {
            background: white; border-radius: 24px; padding: 50px 40px;
            text-align: center; max-width: 460px; width: 90%;
            transform: scale(0.85);
            transition: transform 0.4s cubic-bezier(.34,1.56,.64,1);
        }
        .popup-overlay.popup-visible .popup-commande { transform: scale(1); }
        .popup-icon  { font-size: 60px; margin-bottom: 14px; }
        .popup-commande h2 {
            font-family: 'Playfair Display', serif;
            color: #5c3b1e; font-size: 28px; margin-bottom: 8px;
        }
        .popup-commande p { color: #666; font-size: 15px; }
        .popup-numero {
            background: #f4e7d3; color: #5c3b1e; font-weight: 700;
            font-size: 20px; padding: 12px 24px; border-radius: 10px;
            margin: 14px auto; letter-spacing: 1.5px; display: inline-block;
        }
        .popup-eta     { margin: 10px 0; color: #555 !important; }
        .popup-contact { font-size: 13px !important; color: #999 !important; margin-bottom: 25px; }
        .popup-btn {
            background: #d4af37; color: white; border: none;
            padding: 14px 36px; border-radius: 30px; font-weight: 700;
            font-size: 15px; font-family: 'Poppins', sans-serif;
            cursor: pointer; transition: background 0.25s, transform 0.2s;
        }
        .popup-btn:hover { background: #b8962f; transform: translateY(-2px); }

        /* VALIDATION */
        input.champ-erreur { border-color: #f44336 !important; }
        input.champ-ok     { border-color: #4caf50 !important; }
        .msg-erreur {
            color: #f44336; font-size: 11.5px;
            margin: -6px 0 10px 2px; display: block;
        }

        /* ZONE MOMO */
        .zone-momo { margin-top: 12px; animation: fadeSlideUp 0.3s ease; }
        .momo-hint { font-size: 12px; color: #888; margin: 4px 0 0 2px; font-style: italic; }

        /* LISTE ARTICLES LIVRAISON */
        .liv-article-ligne {
            display: flex; justify-content: space-between;
            align-items: center; font-size: 13px; padding: 5px 0;
            border-bottom: 1px dashed #eee; gap: 8px;
        }
        .liv-article-nom {
            flex: 1; white-space: nowrap; overflow: hidden;
            text-overflow: ellipsis; color: #333;
        }
        .liv-article-qty { color: #888; font-size: 12px; white-space: nowrap; }
        .liv-article-prix { font-weight: 600; color: #5c3b1e; white-space: nowrap; }
        .liv-nb-articles { text-align: center; font-size: 12px; color: #aaa; margin-top: 10px; }
    `;
    document.head.appendChild(style);
}

/* ═══════════════════════════════════════════════
    7. INITIALISATION
═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
    _injecterStyles();
    _updateBadgeNavbar();
    _renderPageCommande();

    // API publique — consommée par livraison.js et AU MBOA🇨🇲.js
    window.Panier = {
        get:               getPanier,
        ajouter:           ajouterArticle,
        supprimer:         supprimerArticle,
        changerQuantite:   changerQuantite,
        vider:             viderPanier,
        sousTotal:         calculerSousTotal,
        frais:             calculerFrais,
        total:             calculerTotal,
        compterArticles:   compterArticles,
        formatPrix:        formatPrix,
        genererIdCommande: genererIdCommande,
        afficherToast:     afficherToast,
        afficherPopup:     afficherPopupCommande,
        FRAIS_SERVICE:     FRAIS_SERVICE,
        SEUIL_GRATUIT:     SEUIL_GRATUIT,
        COMMANDES_KEY:     COMMANDES_KEY,
        storageGet:        storageGet,
        storageSet:        storageSet,
    };
});
