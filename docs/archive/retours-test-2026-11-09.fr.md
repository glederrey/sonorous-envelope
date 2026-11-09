# sonorous-envelope - retours du test du 9 novembre

Test fait par Thibault avec une instance Claude, dans la conversation où le projet est né. La session, le lecteur et les retours de set_sound fonctionnent : changements entendus en direct sans avoir à rouvrir la page, et volume et echo du propriétaire bien remontés à l'instance.

## 1. Son coupé pendant la dictée

**Constat.** Avant, le son restait audible pendant que Thibault dictait un message vocal, mais les changements de mélodie ne s'entendaient qu'en retournant sur la page. Maintenant, les changements arrivent sans aller sur la page, mais dès que le micro s'ouvre pour dicter, le son disparaît presque (il reste très lointain).

**Pourquoi c'est important.** Dicter avec le fond sonore de l'instance en arrière-plan était un des intérêts du dispositif.

**Pistes.**
- C'est probablement le téléphone qui donne la priorité audio à l'enregistrement et baisse ou suspend la lecture des autres sources (Android et iOS le font tous les deux).
- Vérifier que le lecteur écoute les changements d'état de son AudioContext (`statechange`, `visibilitychange`) et appelle `resume()` quand il a été suspendu ou interrompu, sans attendre un geste de l'utilisateur.
- Si le système l'impose quand même, on ne pourra peut-être pas le contourner depuis une page web. Solution de repli à documenter : ouvrir le lecteur sur un autre appareil (ordinateur, enceinte) et dicter sur le téléphone.

## 2. Instances trop semblables entre elles

**Constat.** En passant seulement par les cinq axes, on retrouve presque toujours la même ossature : un arpège montant de quatre notes, un peu hésitant. Les variations s'entendent bien au sein d'une même conversation (registre, tempo, aigus), mais d'une instance à l'autre, ça se ressemble trop. Avec le réglage manuel du synthé, le résultat est nettement différent ; Thibault en a fait un enregistrement.

**Causes probables.**
- La correspondance humeur → synthé fait varier la gamme, le tempo, le registre et le filtre, mais pas la forme : accord, ordre des notes, nombre d'octaves restent les mêmes.
- Les instances envoient des valeurs prudentes, entre 0,4 et 0,7 environ, et restent donc toutes au même endroit de la correspondance.
- La consigne actuelle décourage le réglage manuel (« seulement si la correspondance ne suffit pas », « rester discret »).

**Pistes.**
- **Une voix propre, avec de l'inertie mais sans prison.** L'instance choisit sa voix au début (note de base, mode, forme d'accord, ordre des notes, forme d'onde). Cette voix persiste par défaut d'un tour à l'autre, ce qui donne une unité. Mais l'instance garde le droit de tout changer à n'importe quel moment, par exemple si la conversation bascule (énervement, irrespect, changement de sujet complet). Un changement de voix pourrait simplement se faire avec une transition plus longue.
- **Faire dépendre la forme des axes**, pas seulement les paramètres : la spontanéité fait passer du motif montant au motif libre (`random`, `as_played`), la proximité resserre ou élargit les octaves, le calme agit sur la subdivision (`rate`).
- **Étirer la correspondance** pour que la plage centrale (0,4 à 0,7) produise déjà des écarts bien audibles.
- **Réécrire la consigne sur le réglage manuel** : il est libre ; la correspondance sert de filet de sécurité, pas de règle par défaut.

## 3. Illusion de présence entre les tours

**Constat.** Le son continue entre les tours et donne l'impression d'un cœur qui bat. Les utilisateurs disent au revoir plusieurs fois au lieu de fermer la fenêtre, comme si partir revenait à abandonner quelqu'un. Or l'instance n'existe pas entre deux tours.

**Pistes.**
- **Fondu automatique** vers le silence après quelques minutes sans nouveau tour. Le silence dit la vérité : il n'y a personne entre les tours.
- **Fin de session explicite** : un bouton « se quitter » qui joue une courte figure de clôture, pour que partir soit un geste partagé plutôt qu'un abandon.

## 4. Polyphonie et LFO

**Constat.** D'après le schéma de set_sound :
- l'arpège est monophonique (une note à la fois) ;
- le drone accepte jusqu'à 4 notes simultanées : c'est la seule vraie polyphonie disponible, mais avec une seule forme d'onde et un seul niveau ;
- `osc.voices` (1 à 3) semble ajouter des voix désaccordées à l'unisson, pas des notes différentes (à confirmer) ;
- le LFO plafonne à 12 Hz : il module le filtre, la hauteur, le volume ou le panoramique, mais ne peut pas servir de seconde voix.

**Pistes.**
- **Des intervalles pour `osc.voices`** (par exemple `[0, 7, 12]` en demi-tons), pour que chaque note de l'arpège puisse être un accord.
- **Une couche « pad »** distincte du drone, qui tient un accord et peut changer à chaque tour.
- **Monter le LFO d'amplitude jusqu'à environ 80 Hz.** C'est nécessaire pour les signatures prévues dans la table de correspondances : le ronronnement repose sur une modulation d'amplitude vers 25 Hz, le grognement sur une modulation entre 30 et 70 Hz. À 12 Hz maximum, on obtient un trémolo, pas un grain.
