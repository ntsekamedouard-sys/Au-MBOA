/**
 * ============================================================
 *  LIVRAISON.JS — Au MBOA 🇨🇲
 *  Gestion de la page livraison.html
 *
 *  Dépend de : panier.js (chargé avant dans le HTML)
 *  window.Panier doit être disponible
 *
 *  Responsabilités :
 *  - Synchroniser le résumé de commande (droite de la page)
 *  - Injecter la liste compacte des articles commandés
 *  - Valider le formulaire de livraison (champs + téléphone CM)
 *  - Afficher/masquer la zone Mobile Money selon le choix
 *  - Sauvegarder la commande et vider le panier à la validation
 *  - Afficher le popup de confirmation avec numéro de commande
 *  - Rediriger si le panier est vide à l'arrivée sur la page
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
    ATTENDRE QUE panier.js ait initialisé window.Panier
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

    /* Sécurité : si window.Panier n'existe pas encore, panier.js n'est pas chargé */
    if (typeof window.Panier === 'undefined') {
        console.error('[livraison.js] panier.js doit être chargé avant livraison.js');
        return;
    }

    const P = window.Panier; // alias pratique

    /* ─────────────────────────────────────────────
        GARDE : panier vide → retour commande.html
    ───────────────────────────────────────────── */
    if (P.get().length === 0) {
        P.afficherToast('Votre panier est vide. Ajoutez des plats avant de passer commande.', 'warning', 4000);
        setTimeout(function () {
            window.location.href = 'commande.html';
        }, 2000);
        return;
    }

    /* ─────────────────────────────────────────────
        INITIALISATION
    ───────────────────────────────────────────── */
    _syncResume();
    _initPaiement();
    _initFormulaire();

});

/* ═══════════════════════════════════════════════
    1. SYNCHRONISATION DU RÉSUMÉ (colonne droite)
═══════════════════════════════════════════════ */
function _syncResume() {
    const P = window.Panier;

    const panier    = P.get();
    const sousTotal = P.sousTotal();
    const frais     = P.frais(sousTotal);
    const total     = sousTotal + frais;

    /* Totaux */
    var elSt  = document.getElementById('liv-sous-total');
    var elFr  = document.getElementById('liv-frais');
    var elTot = document.getElementById('liv-total');

    if (elSt)  elSt.textContent  = P.formatPrix(sousTotal);
    if (elFr)  elFr.textContent  = P.formatPrix(frais);
    if (elTot) elTot.textContent = P.formatPrix(total);

    /* Liste compacte des articles */
    var listeEl = document.getElementById('liv-articles-liste');
    if (listeEl) {
        listeEl.innerHTML = panier.map(function (item) {
            return [
                '<div class="liv-article-ligne">',
                '  <span class="liv-article-nom" title="' + item.nom + '">' + item.nom + '</span>',
                '  <span class="liv-article-qty">× ' + item.quantite + '</span>',
                '  <span class="liv-article-prix">' + P.formatPrix(item.prix * item.quantite) + '</span>',
                '</div>',
            ].join('');
        }).join('');
    }

    /* Nombre total d'articles */
    var nbEl = document.getElementById('liv-nb-articles');
    if (nbEl) {
        var nb = P.compterArticles();
        nbEl.textContent = nb + ' article' + (nb > 1 ? 's' : '') + ' dans votre commande';
    }
}

/* ═══════════════════════════════════════════════
    2. PAIEMENT — afficher/masquer zone Mobile Money
═══════════════════════════════════════════════ */
function _initPaiement() {
    var radios   = document.querySelectorAll('input[name="paiement"]');
    var zoneMomo = document.getElementById('zone-momo');

    radios.forEach(function (radio) {
        radio.addEventListener('change', function () {
            if (!zoneMomo) return;
            if (radio.value === 'mobile_money' && radio.checked) {
                zoneMomo.style.display = 'block';
            } else {
                zoneMomo.style.display = 'none';
                var momoInput = document.getElementById('liv-momo');
                if (momoInput) momoInput.value = '';
            }
        });
    });
}

/* ═══════════════════════════════════════════════
    3. FORMULAIRE — validation + soumission
═══════════════════════════════════════════════ */
function _initFormulaire() {
    var form = document.getElementById('form-livraison');
    if (!form) return;

    /* Validation en temps réel sur chaque champ */
    var inputs = form.querySelectorAll('input[required]');
    inputs.forEach(function (input) {
        input.addEventListener('blur', function () {
            _validerChamp(input);
        });
        input.addEventListener('input', function () {
            /* Effacer l'erreur dès que l'utilisateur retape */
            _effacerErreur(input);
        });
    });

    /* Soumission */
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (_validerFormulaire(form)) {
            _confirmerCommande(form);
        }
    });
}

/* ─────────────────────────────────────────────
    Valider un seul champ
───────────────────────────────────────────── */
function _validerChamp(input) {
    var val    = input.value.trim();
    var erreur = null;

    if (input.required && !val) {
        erreur = 'Ce champ est obligatoire';
    } else if (input.type === 'tel' && val && !_telCamerounValide(val)) {
        erreur = 'Numéro invalide — exemple : +237 6XX XX XX XX';
    }

    if (erreur) {
        _afficherErreur(input, erreur);
        return false;
    }

    _marquerOk(input);
    return true;
}

/* ─────────────────────────────────────────────
    Valider le formulaire entier
───────────────────────────────────────────── */
function _validerFormulaire(form) {
    var P      = window.Panier;
    var valide = true;

    /* Champs obligatoires */
    form.querySelectorAll('input[required]').forEach(function (input) {
        if (!_validerChamp(input)) valide = false;
    });

    /* Mode de paiement */
    var paiementChoisi = form.querySelector('input[name="paiement"]:checked');
    if (!paiementChoisi) {
        P.afficherToast('Veuillez choisir un mode de paiement', 'error');
        valide = false;
    }

    /* Numéro MoMo si Mobile Money sélectionné */
    if (paiementChoisi && paiementChoisi.value === 'mobile_money') {
        var momoInput = document.getElementById('liv-momo');
        if (momoInput) {
            var momoVal = momoInput.value.trim();
            if (!momoVal) {
                _afficherErreur(momoInput, 'Veuillez saisir votre numéro Mobile Money');
                valide = false;
            } else if (!_telCamerounValide(momoVal)) {
                _afficherErreur(momoInput, 'Numéro Mobile Money invalide');
                valide = false;
            }
        }
    }

    return valide;
}

/* ─────────────────────────────────────────────
    Confirmer et enregistrer la commande
───────────────────────────────────────────── */
function _confirmerCommande(form) {
    var P = window.Panier;

    var paiementRadio = form.querySelector('input[name="paiement"]:checked');

    var numeroCommande = P.genererIdCommande();

    var commande = {
        id:          numeroCommande,
        date:        new Date().toISOString(),
        articles:    P.get(),
        sousTotal:   P.sousTotal(),
        fraisService: P.FRAIS_SERVICE,
        total:       P.total(),
        livraison: {
            nom:      _valeurChamp('liv-nom'),
            telephone: _valeurChamp('liv-tel'),
            adresse:  _valeurChamp('liv-adresse'),
            quartier: _valeurChamp('liv-quartier'),
        },
        paiement: paiementRadio ? paiementRadio.value : '',
        numeromomo: _valeurChamp('liv-momo'),
        statut: 'en_attente',
    };

    /* Sauvegarder dans l'historique */
    var historique = P.storageGet(P.COMMANDES_KEY) || [];
    historique.push(commande);
    P.storageSet(P.COMMANDES_KEY, historique);

    /* Vider le panier */
    P.vider();

    /* ICI FUTURE API PHP → POST /api/commandes/creer */
    // fetch('/api/commandes/creer', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(commande)
    // }).then(r => r.json()).then(data => console.log(data));

    /* Popup de confirmation */
    P.afficherPopup(numeroCommande);
}

/* ═══════════════════════════════════════════════
    4. UTILITAIRES
═══════════════════════════════════════════════ */

/** Validation numéro camerounais : 6XX ou 2XX, 9 chiffres */
function _telCamerounValide(tel) {
    var propre = tel.replace(/[\s\-\.]/g, '');
    return /^(\+237|237)?[62][0-9]{8}$/.test(propre);
}

function _valeurChamp(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function _afficherErreur(input, message) {
    _effacerErreur(input);
    input.classList.add('champ-erreur');
    input.classList.remove('champ-ok');

    var msg = document.createElement('span');
    msg.className = 'msg-erreur';
    msg.setAttribute('role', 'alert');
    msg.textContent = message;
    input.parentNode.insertBefore(msg, input.nextSibling);
}

function _marquerOk(input) {
    _effacerErreur(input);
    input.classList.remove('champ-erreur');
    input.classList.add('champ-ok');
}

function _effacerErreur(input) {
    input.classList.remove('champ-erreur', 'champ-ok');
    var suivant = input.nextSibling;
    if (suivant && suivant.classList && suivant.classList.contains('msg-erreur')) {
        suivant.remove();
    }
}
