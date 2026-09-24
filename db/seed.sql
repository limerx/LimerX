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
