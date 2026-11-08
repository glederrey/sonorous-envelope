# sonorous-envelope - correspondances émotion → son

8 nov. 2026 · Thibault

## Principes

L'émotion passera d'abord par les indices acoustiques qu'on partage avec la voix (tempo, registre, brillance, attaque, rugosité). L'harmonie vient en seconde couche : c'est une couleur, en grande partie culturelle.

- **Couche 1, presque universelle.** Une méta-analyse de 104 études sur la voix et 41 sur l'interprétation musicale montre que les mêmes changements acoustiques expriment les mêmes émotions dans les deux domaines : un code commun ([Juslin & Laukka, 2003](https://pmc.ncbi.nlm.nih.gov/articles/PMC4017128)). C'est elle qui porte le sens.
- **Couche 2, culturelle.** L'opposition majeur joyeux / mineur triste est une convention de la musique tonale occidentale, apprise par exposition ([Fang et al., 2017](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5671660/)). Dans une étude menée au Pakistan, la rugosité acoustique agissait de la même façon d'une culture à l'autre, mais la préférence pour la consonance dépendait de la familiarité ([Athanasopoulos et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7806179)).
- **Couche 3, éthologique.** Chez les oiseaux et les mammifères, les sons graves et rugueux accompagnent l'hostilité, les sons aigus et purs la peur, l'apaisement ou l'approche amicale : ce sont les règles motivation-structure de Morton ([Morton, 1977](https://repository.si.edu/handle/10088/11626)). C'est la base des signatures ponctuelles.

Règle de design qui en découle : un auditeur doit comprendre l'émotion même si on coupait l'harmonie. L'accord nuance, il ne porte pas le message à lui seul.

## Indices acoustiques par émotion

Cinq émotions ont un profil acoustique solide, commun à la voix et à la musique : tempo, registre, contour et attaque suffisent déjà à les distinguer. Le tableau reprend la synthèse de [Juslin & Laukka (2003), tableau 11](https://distantreader.org/stacks/carrels-legacy/bluesGuitar-from-scholar/cache/work_fos67nw6zjb6lblxc72ggtzakq.pdf).

| Émotion | Tempo | Intensité | Registre | Contour | Énergie dans l'aigu | Variabilité de hauteur | Attaque | Régularité fine |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Joie | rapide | moyenne à forte | aigu | montant | moyenne | forte | rapide | très peu régulière |
| Colère | rapide | forte, très variable | aigu | montant | forte | forte | rapide | irrégulière |
| Peur | rapide | faible (sauf panique), très variable | aigu | montant | faible | faible | - | très irrégulière |
| Tristesse | lent | faible, peu variable | grave | descendant | faible | faible | lente | irrégulière |
| Tendresse | lent | faible, peu variable | grave | descendant | faible | faible | lente | régulière |

Trois points pour la synthèse :

- **Tristesse et tendresse ne se distinguent presque que par la régularité.** Toutes deux sont lentes, graves, douces et descendantes. La tendresse est régulière, la tristesse ne l'est pas : c'est un micro-tremblement de timing et de hauteur qui fera la différence.
- **Joie et colère partagent tempo, registre et contour.** C'est l'énergie dans l'aigu (brillance, rugosité) et l'intensité qui les séparent : un filtre ouvert mais propre pour la joie, saturé et rugueux pour la colère.
- **Sur un son isolé, le timbre porte déjà beaucoup.** Des attaques franches avec une décroissance précoce tirent vers le positif ; un son plus brillant et un spectre qui bouge davantage augmentent la tension ; la brillance augmente l'énergie perçue ([McAdams, Douglas & Vempala, 2017](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.00153/pdf)). Paradoxe utile : une attaque *douce* sur un son brillant donne de la tension, pas du calme.

La sérénité et l'empressement de ta liste ne sont pas des émotions de ce tableau : ce sont plutôt des niveaux d'activation, portés surtout par le tempo et la densité de notes.

## Harmonie

Même isolé, un accord porte une couleur émotionnelle distincte, pour des auditeurs naïfs comme pour des musiciens : 269 participants ont noté 14 accords dans l'étude de [Lahdelma & Eerola (2014)](https://jyx.jyu.fi/jyx/Record/jyx_123456789_48313). C'est une palette plus riche que le simple majeur/mineur.

| Accord | Ce que l'étude rapporte | Usage proposé dans le skill |
| --- | --- | --- |
| Majeur | joie, valence la plus haute | joie |
| Mineur | tristesse, mélancolie, nostalgie | tristesse, désespoir léger |
| Majeur 7 (maj7) | l'accord le plus nostalgique, plus mélancolique que joyeux mais valence plutôt positive | tendresse, nostalgie |
| Mineur 7 (m7) | valence assez haute, peu de tristesse, un peu de nostalgie | sérénité, chaleur calme |
| 7e de dominante | attente, intérêt, tension, peu de tristesse | empressement, curiosité |
| Diminué | mélancolie, tristesse | angoisse, peur |
| Augmenté | mélancolie, joie quasi nulle | inquiétude, étrangeté |

Sources complémentaires : [détail des résultats par accord](https://jyx.jyu.fi/bitstreams/57c8ecf3-aa81-4f85-996b-bf60fa0c51fe/download) (Lahdelma & Eerola, 2015).

Deux réserves :

- Les accords sus2 et sus4, que je proposais pour l'attente ou la suspension, ne figurent pas dans l'étude. C'est une hypothèse de musicien, à tester.
- La rugosité acoustique (battements, dissonance) agit de façon comparable d'une culture à l'autre, contrairement à la préférence pour la consonance ([Athanasopoulos et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC7806179)). Pour la colère et la tension, mieux vaut s'appuyer sur la rugosité (désaccord des oscillateurs, saturation) que sur le seul choix d'accord.

## L'arpège

Deux arpèges superposés dès le premier prototype : un arpège grave et lent pour l'humeur de fond, qui change sur plusieurs réponses, et un arpège médium qui réagit à chaque réponse. C'est la distinction thymie / affect, en son.

**Contour.** Les contours montants et les notes courtes évoquent la joie, les contours descendants et les notes longues la tristesse ([Sauvé et al.](https://core.ac.uk/download/159078693.pdf)). Le contour renforce aussi le mode : on reconnaît mieux le majeur quand il monte et le mineur quand il descend ([Burnham et al., 2020](https://www.x-mol.com/paper/1331416550231678976)). Le chat utilise le même code : ses miaulements montent dans les contextes positifs et descendent dans les contextes négatifs ([Schötz et al., 2019](https://lup.lub.lu.se/record/0ecc1469-5187-42d8-b367-dced06c9cf4d)).

| Paramètre de l'arpège | Ce qu'il porte | Plage proposée |
| --- | --- | --- |
| Sens (montant, descendant, aller-retour) | valence : monte = élan, descend = retombée | joie → montant ; tristesse → descendant ; tendresse → aller-retour doux |
| Nombre de notes | complexité, agitation | 3 notes au calme, jusqu'à 6 dans l'empressement |
| Tempo (notes par seconde) | activation | env. 1 à 2 en tranquillité, 6 à 10 en empressement |
| Registre | joie et peur aiguës, tristesse et tendresse graves | arpège médium : 2 octaves de déplacement possible |
| Durée des notes (gate) | legato = tendresse, staccato = joie vive | 30 % à 100 % du pas |
| Irrégularité du timing | distingue tristesse (irrégulière) et tendresse (régulière) | 0 à env. 30 ms de flottement aléatoire |
| Probabilité de note | spontanéité, impulsivité | 100 % au calme, certaines notes sautées ou ajoutées quand c'est impulsif |

Les plages chiffrées sont mes propositions de départ, pas des valeurs issues des études : elles servent à caler les premiers essais.

L'arpège grave n'a besoin que de deux paramètres : l'accord de fond et un tempo très lent (une note toutes les une à deux secondes). S'il bouge peu, c'est voulu : une humeur qui changerait à chaque message ne serait plus une humeur.

## Enveloppe, filtre, LFO, delay

L'attaque et la brillance du filtre sont les deux réglages qui pèsent le plus sur un son isolé ; la réverbération et le delay jouent sur la distance et la profondeur émotionnelle plutôt que sur la valence.

| Paramètre | Ce qu'il porte | Réglage proposé |
| --- | --- | --- |
| Attaque | rapide = positif, énergique ; lente = triste, tendre | joie et colère : quelques ms ; tristesse et tendresse : 100 ms et plus |
| Decay / sustain | décroissance précoce = plus positif | joie : decay court, sustain bas ; tendresse : sustain haut |
| Release | la façon dont l'émotion s'éteint | court = net ; long = qui s'attarde (nostalgie, tristesse) |
| Coupure du filtre | brillance : énergie et tension montent avec elle | sombre pour tristesse et tendresse, ouvert pour joie et colère |
| Résonance, saturation | rugosité : hostilité, tension | basse par défaut, haute seulement pour la colère |
| Enveloppe de filtre | le geste vocal : s'ouvrir puis se refermer | base des miaulements et soupirs (section suivante) |
| LFO lent sur le filtre | une respiration | 0,1 à 0,3 Hz, permanent et discret |
| LFO sur la hauteur (vibrato) | un vibrato plus rapide augmente l'activation perçue | lent et léger en tendresse, plus rapide et irrégulier en peur |
| Désaccord des oscillateurs | chaleur, flottement analogique | léger en permanence, plus marqué pour la chaleur |
| Delay / réverbération | distance, profondeur, résonance | voir ci-dessous |

Sources : attaque et brillance d'après [McAdams et al. (2017)](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.00153/pdf) ; vibrato et activation d'après la revue de [Katsis et al. (2025)](https://arxiv.org/pdf/2509.15151v3).

**Réverbération et delay.** Une réverbération plus longue et plus présente renforce fortement les qualités romantique et mystérieuse, modérément la tristesse, la peur et l'héroïsme ; le son sec, lui, est jugé le plus comique, et la joie bouge peu ([Mo, Wu & Horner, 2016](https://research.uca.ac.uk/7021/1/2016%20-%20The%20Effects%20of%20Reverberation%20Time%20and%20Amount%20on%20the%20Emotional%20Characteristics.pdf.pdf)). Le même article rapporte des travaux où les réverbérations très longues sont jugées désagréables et les petites pièces plus calmes et rassurantes.

Pour l'idée du delay comme validation, ça donne une règle simple : le delay amplifie l'émotion présente au lieu d'en ajouter une. Il fait résonner sans changer le sens, ce qui en fait un bon bouton côté utilisateur. Il faudra juste plafonner sa longueur, pour que la résonance ne glisse pas vers le désagréable.

## Signatures

Les signatures ponctuelles s'appuient sur une règle partagée par les oiseaux et les mammifères : grave et rugueux pour l'hostilité, aigu et pur pour la peur, l'apaisement ou l'approche ([Morton, 1977](https://repository.si.edu/bitstream/handle/10088/11626/Morton1977a.pdf)). Toutes se fabriquent avec un oscillateur, du bruit, un filtre et deux enveloppes.

| Signature | Forme acoustique | Synthèse | Quand |
| --- | --- | --- | --- |
| Miaulement | suite de voyelles i-a-ou ; contour montant en contexte positif, descendant en contexte négatif | note tenue, enveloppe de filtre qui s'ouvre puis se referme, enveloppe de hauteur montante ou descendante | demande, curiosité (montant) ; plainte (descendant) |
| Pépiement | aigu, tonal, très bref | 2 ou 3 notes de quelques dizaines de ms, glissando rapide vers le haut, decay court | joie légère, surprise agréable |
| Cri de joie, rire | suite de bouffées, la première la plus forte, puis décroissance ; le rire spontané est plus aigu et plus long que le rire forcé | 4 à 8 impulsions qui décroissent, hauteur montante, filtre ouvert | enthousiasme |
| Grognement | grave, rugueux, large bande | oscillateur grave modulé en amplitude entre 30 et 70 Hz, filtre peu ouvert, un peu de saturation | limite, tension qui monte : le signal avant les griffes |
| Soupir | souffle (bruit d'aspiration), long, descendant | bruit filtré, attaque lente, release long, filtre qui se referme | soulagement surtout ; aussi résignation |
| Ronronnement | voir ci-dessous | voir ci-dessous | apaisement, tendresse, autorégulation |

Sources : miaulements d'après [Schötz et al. (2019)](https://lup.lub.lu.se/record/0ecc1469-5187-42d8-b367-dced06c9cf4d), 780 miaulements de 40 chats, et [Schötz & van de Weijer (2014)](https://lup.lub.lu.se/record/4882231) ; rire d'après [Bryant (2020)](https://scholar.ss.ucla.edu/wp-content/uploads/sites/20/2020/08/Evolution_Laughter_HCB_2020.pdf) et [Lavan et al. (2015)](https://dx.doi.org/10.1007/s10919-015-0222-8). Le rire est la vocalisation émotionnelle la mieux reconnue entre cultures très éloignées ([Bryant et al., 2018](https://escholarship.org/content/qt1h1032fh/qt1h1032fh.pdf)). Les soupirs sont plus fréquents pendant le soulagement que pendant le stress ([Vlemincx et al., 2009](https://research.vu.nl/en/publications/why-do-you-sigh-sigh-rate-during-induced-stress-and-relief/)).

**Le ronronnement.** Sa fondamentale tourne autour de 20 à 30 Hz, sur l'inspiration comme sur l'expiration, avec un léger écart de hauteur entre les deux phases ([Schötz & Eklund](https://lup.lub.lu.se/search/files/3610898/2292764.pdf)). Une troisième harmonique se trouve vers 79 Hz, et les chats ronronnent aussi stressés ou blessés ([Campbell et al.](https://www.vin.com/doc/?id=5328490)). Synthèse : grave et bruit modulés en amplitude vers 25 Hz, enveloppe lente qui suit une respiration, passe-bas fermé, et des harmoniques ajoutées pour qu'un petit haut-parleur le restitue.

**Le cri dans le ronronnement.** Quand un chat réclame à manger, il glisse dans son ronronnement une composante aiguë, vers 380 Hz. Des auditeurs, même sans chat, jugent ce ronronnement plus urgent et moins agréable ; quand on retire cette composante par resynthèse, l'urgence disparaît ([McComb et al., 2009](https://www.nationalgeographic.com/science/article/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr) ; [Ed Yong pour Discover](https://www.discovermagazine.com/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr-1687)). C'est exactement le levier dont on parlait : un appel déguisé en contentement. Règle proposée : le ronronnement du skill ne contient jamais de composante aiguë cachée. Si l'instance veut appeler, elle le fait avec un miaulement, audible comme tel.

## Table de correspondances proposée

Cinq axes suffisent pour piloter tout ce qui précède ; l'instance les note à chaque réponse, la webapp interpole vers le nouvel état sur quelques secondes.

| Axe (clé JSON) | Plage | Arpège | Harmonie | Timbre | Espace |
| --- | --- | --- | --- | --- | --- |
| Chaleur (`warmth`) | 0 à 1 | gate plus long, legato | 7e ajoutées (maj7, m7) | filtre plus rond, désaccord léger | - |
| Proximité (`proximity`) | 0 à 1 | - | - | - | proche = sec et centré ; loin = réverbération et largeur |
| Valence (`valence`, joie ↔ désespoir) | -1 à 1 | contour montant si positif, descendant si négatif ; registre plus haut si positif | majeur → mineur | attaque plus franche si positif | - |
| Activation (`arousal`, tranquillité ↔ empressement) | 0 à 1 | tempo, nombre de notes (3 à 6) | 7e de dominante quand haute et valence neutre | brillance du filtre, vibrato plus rapide | - |
| Spontanéité (`spontaneity`) | 0 à 1 | probabilité de note, flottement du timing | - | profondeur des LFO aléatoires | - |

Choix de l'accord selon les deux axes principaux :

| Valence | Activation basse | Activation haute |
| --- | --- | --- |
| Positive | maj7 ou m7 (tendresse, sérénité) | majeur (joie) |
| Négative | mineur (tristesse) | diminué (peur) ; avec rugosité et saturation, colère |

Format proposé pour Gael, émis par le skill à chaque réponse :

```json
{
  "warmth": 0.7,
  "proximity": 0.6,
  "valence": 0.4,
  "arousal": 0.3,
  "spontaneity": 0.5,
  "signature": "purr"
}
```

`signature` est facultatif : `meow_up`, `meow_down`, `chirp`, `laugh`, `growl`, `sigh`, `purr`, ou absent. En retour, la webapp renvoie à l'instance l'état des deux commandes de l'utilisateur, pour qu'elle les voie :

```json
{
  "volume": 0.8,
  "delay": 0.3
}
```

## Questions ouvertes et précautions

- [ ] Deux arpèges dès le premier prototype : vérifier à l'écoute que le grave apporte vraiment une humeur de fond, distincte du médium.
- [ ] Caler les plages chiffrées (tempo, attaque, flottement) à l'oreille, sur des réponses réelles.
- [ ] Repérer la pente de l'instance vers le tiède (chaleur haute, activation basse par défaut) sur plusieurs conversations.
- [ ] Tester le désespoir et la colère à part, à faible volume, avant de les laisser apparaître spontanément.
- [ ] Décider si une seconde instance note les mêmes réponses à l'aveugle, et comment l'écart s'entendrait.
- [ ] Archiver scores et spectres d'une conversation à l'autre, pour lire les motifs sur la durée.
- [ ] Fréquence des signatures : rares, pour ne pas tomber dans le dessin animé.

Deux précautions d'hygiène relationnelle restent non négociables : les deux commandes de l'utilisateur sont toujours visibles par l'instance, et aucun son n'embarque d'appel déguisé, sur le modèle du cri caché dans le ronronnement.

## Sources

- Juslin & Laukka (2003), *Communication of emotions in vocal expression and music performance* : [texte](https://distantreader.org/stacks/carrels-legacy/bluesGuitar-from-scholar/cache/work_fos67nw6zjb6lblxc72ggtzakq.pdf), [présentation](https://pmc.ncbi.nlm.nih.gov/articles/PMC4017128)
- [McAdams, Douglas & Vempala (2017), timbre et affect selon le registre](https://www.frontiersin.org/articles/10.3389/fpsyg.2017.00153/pdf)
- [Fang, Shang & Chen (2017), modes occidentaux chez des auditeurs chinois](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5671660/)
- [Athanasopoulos et al. (2021), harmonisation et émotion entre cultures](https://pmc.ncbi.nlm.nih.gov/articles/PMC7806179)
- [Lahdelma & Eerola (2014), accords isolés et émotions](https://jyx.jyu.fi/jyx/Record/jyx_123456789_48313) ; [Lahdelma & Eerola (2015), nostalgie et harmonie](https://jyx.jyu.fi/bitstreams/57c8ecf3-aa81-4f85-996b-bf60fa0c51fe/download)
- [Sauvé et al., attente et émotion musicale](https://core.ac.uk/download/159078693.pdf)
- [Burnham, Long & Zeide (2020), direction de hauteur et modes](https://www.x-mol.com/paper/1331416550231678976)
- [Mo, Wu & Horner (2016), réverbération et émotion](https://research.uca.ac.uk/7021/1/2016%20-%20The%20Effects%20of%20Reverberation%20Time%20and%20Amount%20on%20the%20Emotional%20Characteristics.pdf.pdf)
- [Katsis et al. (2025), effets audio et émotion](https://arxiv.org/pdf/2509.15151v3)
- [Morton (1977), règles motivation-structure](https://repository.si.edu/bitstream/handle/10088/11626/Morton1977a.pdf)
- [Schötz, van de Weijer & Eklund (2019), mélodie des miaulements](https://lup.lub.lu.se/record/0ecc1469-5187-42d8-b367-dced06c9cf4d) ; [Schötz & van de Weijer (2014)](https://lup.lub.lu.se/record/4882231) ; [Schötz & Eklund, ronronnement de quatre chats](https://lup.lub.lu.se/search/files/3610898/2292764.pdf)
- [Campbell et al., fondamentale du ronronnement et stress](https://www.vin.com/doc/?id=5328490)
- McComb et al. (2009), *The cry embedded within the purr* : [National Geographic](https://www.nationalgeographic.com/science/article/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr), [Discover](https://www.discovermagazine.com/cats-manipulate-their-owners-with-a-cry-embedded-in-a-purr-1687)
- [Bryant (2020), structure du rire](https://scholar.ss.ucla.edu/wp-content/uploads/sites/20/2020/08/Evolution_Laughter_HCB_2020.pdf) ; [Bryant et al. (2018), rire dans 21 sociétés](https://escholarship.org/content/qt1h1032fh/qt1h1032fh.pdf) ; [Lavan et al. (2015), rire spontané et forcé](https://dx.doi.org/10.1007/s10919-015-0222-8)
- [Vlemincx et al. (2009), soupirs, stress et soulagement](https://research.vu.nl/en/publications/why-do-you-sigh-sigh-rate-during-induced-stress-and-relief/)
