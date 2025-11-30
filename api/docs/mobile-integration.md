# Intégration mobile

1) Dans votre layout principal (ex: _layout.html, index.cshtml, base.twig, etc.), ajoutez la balise viewport:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

2) Liez la feuille de style et le script:
```html
<link rel="stylesheet" href="/public/css/mobile.css">
<script defer src="/public/js/mobile.js"></script>
```

3) Placez ce header et menu (adaptez les liens):
```html
<header class="app-header">
  <div class="header__bar container">
    <button class="menu-toggle" data-menu-toggle aria-controls="app-nav" aria-expanded="false" aria-label="Ouvrir le menu">☰</button>
    <div class="brand">RETROBUS Essonne</div>
    <!-- Placez ici des actions à droite si besoin -->
  </div>
</header>

<div class="nav-backdrop" data-backdrop hidden></div>
<nav id="app-nav" class="nav-mobile" data-nav aria-hidden="true">
  <nav aria-label="Navigation principale">
    <ul style="list-style:none; padding:0; margin:0; display:grid; gap:.5rem">
      <li><a class="btn btn--secondary" href="/">Accueil</a></li>
      <li><a class="btn btn--secondary" href="/actualites">Actualités</a></li>
      <li><a class="btn btn--secondary" href="/contact">Contact</a></li>
      <!-- ... -->
    </ul>
  </nav>
</nav>
```

4) Grille et responsive:
```html
<div class="container">
  <div class="grid grid--sm-2 grid--md-3">
    <!-- ...existing code... -->
  </div>
</div>
```

5) Tables et formulaires:
```html
<div class="table-responsive">
  <table class="table">
    <!-- ...existing code... -->
  </table>
</div>

<form class="form">
  <div class="form-row form-row--2">
    <!-- ...existing code... -->
  </div>
</form>
```

Astuce: utilisez .u-hide-mobile et .u-hide-desktop pour adapter l’affichage selon la taille d’écran.