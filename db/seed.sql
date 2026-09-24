-- Domaines de connaissance initiaux.
-- Ajouter une ligne ici (ou via SQL direct) suffit pour preparer un nouveau domaine
-- avant d'y ingerer des documents avec `npm run ingest`.

INSERT INTO domains (slug, name, description, is_public)
VALUES (
  'nf-c15-100',
  'NF C15-100 - Installations electriques basse tension',
  'Norme francaise regissant la conception, la realisation et la verification des installations electriques basse tension.',
  false
)
ON CONFLICT (slug) DO NOTHING;

-- Regles de dimensionnement (section de cable / calibre disjoncteur) du Tableau 10-1F
-- (NF C15-100-10.1.6.5 et NF C15-100-10.1.7.7.2, page 16 du document ingere).
-- Saisie une fois pour toutes ; pas de ON CONFLICT ligne par ligne (pas de cle naturelle
-- stable), on protege juste contre une double execution du seed pour ce domaine.
DO $$
DECLARE
  v_domain_id UUID;
BEGIN
  SELECT id INTO v_domain_id FROM domains WHERE slug = 'nf-c15-100';

  IF v_domain_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM circuit_sizing_rules WHERE domain_id = v_domain_id) THEN

    INSERT INTO circuit_sizing_rules
      (domain_id, category, subcategory, power_min_w, power_max_w, phase, min_section_mm2, max_breaker_amps, notes, source_ref, source_page, display_order)
    VALUES
      (v_domain_id, 'Eclairage', 'Point d''eclairage ou prise commandee', NULL, NULL, NULL, 1.5, 16, NULL, 'Tableau 10-1F', 16, 10),

      (v_domain_id, 'Prise de courant 16A', 'Circuit avec 8 prises max', NULL, NULL, NULL, 1.5, 16, NULL, 'Tableau 10-1F', 16, 20),
      (v_domain_id, 'Prise de courant 16A', 'Circuit avec 12 prises max', NULL, NULL, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 21),
      (v_domain_id, 'Prise de courant 16A', 'Circuit cuisine, 6 prises non specialisees max', NULL, NULL, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 22),
      (v_domain_id, 'Prise de courant 16A', 'Circuits specialises (lave-linge, seche-linge, four...)', NULL, NULL, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 23),

      (v_domain_id, 'Volets roulants', NULL, NULL, NULL, NULL, 1.5, 16, NULL, 'Tableau 10-1F', 16, 30),

      (v_domain_id, 'VMC, VMR', NULL, NULL, NULL, NULL, 1.5, 2, NULL, 'Tableau 10-1F', 16, 40),

      (v_domain_id, 'Pilotage', 'Circuit d''asservissement tarifaire fil pilote, gestionnaire d''energie', NULL, NULL, NULL, 1.5, 2, NULL, 'Tableau 10-1F', 16, 50),

      (v_domain_id, 'Chauffe-eau', 'Chauffe-eau electrique non instantane', NULL, NULL, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 60),

      (v_domain_id, 'Cuisson', 'Plaque de cuisson, cuisiniere', NULL, NULL, 'mono', 6, 32, NULL, 'Tableau 10-1F', 16, 70),
      (v_domain_id, 'Cuisson', 'Plaque de cuisson, cuisiniere', NULL, NULL, 'tri', 2.5, 20, NULL, 'Tableau 10-1F', 16, 71),

      (v_domain_id, 'Chauffage 230V (emetteurs muraux)', 'Convecteurs, panneaux radiants', NULL, 3500, NULL, 1.5, 16, NULL, 'Tableau 10-1F', 16, 80),
      (v_domain_id, 'Chauffage 230V (emetteurs muraux)', 'Convecteurs, panneaux radiants', 3501, 4500, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 81),
      (v_domain_id, 'Chauffage 230V (emetteurs muraux)', 'Convecteurs, panneaux radiants', 4501, 5750, NULL, 4, 25, NULL, 'Tableau 10-1F', 16, 82),
      (v_domain_id, 'Chauffage 230V (emetteurs muraux)', 'Convecteurs, panneaux radiants', 5751, 7250, NULL, 6, 32, NULL, 'Tableau 10-1F', 16, 83),

      (v_domain_id, 'Chauffage - plancher chauffant', 'Accumulation ou direct, cables autoregulants (Tableau 733.1)', NULL, 1700, NULL, 1.5, 16, NULL, 'Tableau 10-1F', 16, 90),
      (v_domain_id, 'Chauffage - plancher chauffant', 'Accumulation ou direct, cables autoregulants (Tableau 733.1)', 1701, 3400, NULL, 2.5, 25, NULL, 'Tableau 10-1F', 16, 91),
      (v_domain_id, 'Chauffage - plancher chauffant', 'Accumulation ou direct, cables autoregulants (Tableau 733.1)', 3401, 4200, NULL, 4, 32, NULL, 'Tableau 10-1F', 16, 92),
      (v_domain_id, 'Chauffage - plancher chauffant', 'Accumulation ou direct, cables autoregulants (Tableau 733.1)', 4201, 5400, NULL, 6, 40, NULL, 'Tableau 10-1F', 16, 93),
      (v_domain_id, 'Chauffage - plancher chauffant', 'Accumulation ou direct, cables autoregulants (Tableau 733.1)', 5401, 7500, NULL, 10, 50, NULL, 'Tableau 10-1F', 16, 94),

      (v_domain_id, 'Autres circuits', 'Y compris alimentation du tableau divisionnaire', NULL, NULL, NULL, 1.5, 16,
        'Valeurs sans prise en compte des chutes de tension (voir article 525, NF C15-100-1). Pour sections superieures, se reporter aux regles generales.', 'Tableau 10-1F', 16, 100),
      (v_domain_id, 'Autres circuits', 'Y compris alimentation du tableau divisionnaire', NULL, NULL, NULL, 2.5, 20,
        'Valeurs sans prise en compte des chutes de tension (voir article 525, NF C15-100-1). Pour sections superieures, se reporter aux regles generales.', 'Tableau 10-1F', 16, 101),
      (v_domain_id, 'Autres circuits', 'Y compris alimentation du tableau divisionnaire', NULL, NULL, NULL, 4, 25,
        'Valeurs sans prise en compte des chutes de tension (voir article 525, NF C15-100-1). Pour sections superieures, se reporter aux regles generales.', 'Tableau 10-1F', 16, 102),
      (v_domain_id, 'Autres circuits', 'Y compris alimentation du tableau divisionnaire', NULL, NULL, NULL, 6, 32,
        'Valeurs sans prise en compte des chutes de tension (voir article 525, NF C15-100-1). Pour sections superieures, se reporter aux regles generales.', 'Tableau 10-1F', 16, 103),

      (v_domain_id, 'IRVE (recharge vehicules electriques)', 'Socle de prise 16A 2P+T ou bornes 16A', NULL, NULL, NULL, 2.5, 20, NULL, 'Tableau 10-1F', 16, 110),
      (v_domain_id, 'IRVE (recharge vehicules electriques)', 'Bornes 32A monophase', NULL, NULL, 'mono', 10, 40, NULL, 'Tableau 10-1F', 16, 111),
      (v_domain_id, 'IRVE (recharge vehicules electriques)', 'Bornes 32A triphase (adapte et identifie a cet usage, voir NF C15-100-7-722)', NULL, NULL, 'tri', 10, 40, NULL, 'Tableau 10-1F', 16, 112);

  END IF;
END $$;

-- Volumes de protection de la salle de bain (Tableau 10-1C, NF C15-100-10.1.6.10.2.1 &
-- 10.1.6.10.2.5, page 35 du document ingere).
DO $$
DECLARE
  v_domain_id UUID;
BEGIN
  SELECT id INTO v_domain_id FROM domains WHERE slug = 'nf-c15-100';

  IF v_domain_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM bathroom_protection_zones WHERE domain_id = v_domain_id) THEN

    INSERT INTO bathroom_protection_zones
      (domain_id, zone_name, ip_degree, canalisation_rule, appareillage_rule, usage_material_rule, notes, source_ref, source_page, display_order)
    VALUES
      (v_domain_id, 'Volume 0', 'IPX7',
        'Alimente par TBTS limitee a 12 Vca ou 30 Vcc',
        'Interdit',
        'Alimente par TBTS <= 12 Vca ou 30 Vcc',
        'Pour la baignoire ou la douche avec receveur : volume interieur de la baignoire (ou du receveur). Pour la douche de plain-pied : volume de 10 cm au-dessus du fond, memes limites laterales que le volume 1.',
        'Tableau 10-1C', 35, 10),

      (v_domain_id, 'Volume 1', 'IPX4 ou IPX5 si soumis a des jets d''eau (nettoyage et/ou douches a jets horizontaux)',
        'Classe II ou equivalent ; seules les canalisations necessaires a l''alimentation des appareils situes dans ces volumes sont autorisees',
        'Dispositifs de commande des circuits TBTS limitee a 12 Vca ou 30 Vcc ; commande sans fil sans pile',
        'Classe II et protege par un DDR 30 mA, ou alimente par TBTS limitee a 12 Vca ou 30 Vcc (hors chauffe-eau)',
        'Volume de 2,25 m de haut au-dessus du bord exterieur de la baignoire/receveur (ou cylindre de rayon 1,2 m et hauteur 2,25 m pour une douche sans receveur). Ne comprend pas le volume 0.',
        'Tableau 10-1C', 35, 20),

      (v_domain_id, 'Volume 2', 'IPX4 ou IPX5 si soumis a des jets d''eau (nettoyage et/ou douches a jets horizontaux)',
        'Classe II ou equivalent ; seules les canalisations necessaires a l''alimentation des appareils situes dans ces volumes sont autorisees',
        'Prise rasoir alimentee par un transformateur de separation (puissance assignee entre 20 et 50 VA, conforme NF EN 61558-2-5) ; socle DCL protege par un DDR 30 mA ; commande sans fil sans pile',
        'Classe II et protege par un DDR 30 mA, ou alimente par TBTS limitee a 12 Vca ou 30 Vcc (hors chauffe-eau)',
        'Situe a 0,6 m du bord du volume 1, avec le sol fini comme limite basse et la meme limite en hauteur que le volume 1.',
        'Tableau 10-1C', 35, 30),

      (v_domain_id, 'Volume cache', 'IPX4',
        'Interdit',
        'Interdit',
        'Sous condition : uniquement du materiel TBTS <= 12 Vca ou 30 Vcc (source installee en dehors des volumes 0, 1, 2 et cache), ou materiel d''utilisation alimente individuellement/en TBTS/protege par un DDR <= 30 mA si le volume cache est completement ferme et accessible par demontage a l''aide d''un outil. IPx4 minimum requis dans tous les cas.',
        'Volume situe sous la baignoire, la douche ou le spa.',
        'Tableau 10-1C', 35, 40);

  END IF;
END $$;

-- Equipement minimal par piece (eclairage, prises, multimedia, circuits specialises),
-- extrait du tableau "L'equipement minimal dans le logement" (pages 8-9 du document ingere).
DO $$
DECLARE
  v_domain_id UUID;
BEGIN
  SELECT id INTO v_domain_id FROM domains WHERE slug = 'nf-c15-100';

  IF v_domain_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM room_equipment_minimums WHERE domain_id = v_domain_id) THEN

    INSERT INTO room_equipment_minimums
      (domain_id, room_type, lighting_points, power_outlets, multimedia_outlets, specialized_circuits, other_circuits, notes, source_ref, source_page, display_order)
    VALUES
      (v_domain_id, 'Cuisine',
        '1 point (boite de centre ou d''applique avec DCL, ou prise commandee)',
        '6 prises, dont 4 au-dessus du plan de travail sur un circuit dedie (3 socles admis si surface <= 4 m2 ; 1 prise supplementaire admise pour la hotte, placee au minimum a 1,80 m de haut) + 1 a cote de la commande d''eclairage',
        '-',
        '1 circuit cuisiniere/plaque de cuisson (32 A mono ou 20 A tri) + 3 circuits minimum pour lave-linge, seche-linge, lave-vaisselle ou four',
        'Chauffe-eau electrique, congelateur si emplacement connu, autres circuits specialises selon equipements prevus',
        NULL, 'L''equipement minimal dans le logement', 8, 10),

      (v_domain_id, 'Salle de bain',
        '1 point (boite de centre ou d''applique). Prise commandee interdite. DCL interdit dans les volumes 0 et 1 ; autorise dans le volume 2 avec luminaire adapte ou obturateur IPx4 ; autorise hors volume.',
        '1 prise autorisee hors volume + 1 dans la piece entre 0,90 et 1,30 m (a cote de la commande d''eclairage si celle-ci est a l''interieur) ; prise rasoir (avec transformateur d''isolement) autorisee dans le volume 2',
        '-',
        '-',
        'Chauffe-eau electrique, appareil de chauffage de salle de bain',
        'Voir aussi le detail des volumes de protection IP (Volume 0/1/2/cache).',
        'L''equipement minimal dans le logement', 8, 20),

      (v_domain_id, 'Circulation et locaux >= 4 m2',
        '1 point (boite de centre ou d''applique avec DCL, ou prise commandee)',
        '1 prise obligatoire',
        '-',
        '-',
        '-',
        NULL, 'L''equipement minimal dans le logement', 8, 30),

      (v_domain_id, 'Sejour / salon',
        '1 point (boite de centre ou d''applique avec DCL, ou prise commandee)',
        '5 prises dont 1 a cote de la commande d''eclairage : <= 28 m2 -> 1 prise par tranche de 4 m2 (5 mini) ; > 28 m2 -> a definir avec le maitre d''ouvrage/usager, minimum 7. Si cuisine ouverte sur sejour, surface sejour = surface totale - 8 m2.',
        '2 prises RJ45 (generalement a cote des 2 prises RJ45 du sejour ou dans la piece dediee aux usages multimedia)',
        '-',
        '-',
        'Exemple : 7 prises pour un sejour entre 24 et 28 m2.',
        'L''equipement minimal dans le logement', 8, 40),

      (v_domain_id, 'Chambre(s) ou bureau',
        '1 point (boite de centre ou d''applique avec DCL, ou prise commandee)',
        '3 prises en peripherie + 1 a cote de la commande d''eclairage',
        '1 ou 2 prises RJ45 selon le logement (T2 : 1 minimum, T3 ou plus grand : 2 minimum dans des pieces differentes)',
        '-',
        '-',
        NULL, 'L''equipement minimal dans le logement', 8, 50),

      (v_domain_id, 'WC',
        '1 point (boite de centre ou d''applique avec DCL). Prise de courant commandee interdite.',
        '1 prise a cote de la commande d''eclairage',
        '-',
        '-',
        '-',
        NULL, 'L''equipement minimal dans le logement', 8, 60),

      (v_domain_id, 'Exterieur',
        'A proximite de chaque entree et de chaque porte de garage. 20 lux au sol minimum pour cheminements, escaliers, coursives, parking. Commande reperee par voyant.',
        '-',
        '-',
        '-',
        'Circuit specialise pour points d''utilisation exterieurs non fixes au batiment (volets-roulants, stores bannes, portail, piscine...)',
        NULL, 'L''equipement minimal dans le logement', 8, 70);

  END IF;
END $$;
