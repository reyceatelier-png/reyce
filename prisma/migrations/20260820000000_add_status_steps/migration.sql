-- Ajoute deux statuts intermédiaires au cycle de vie du rendez-vous :
-- "véhicule déposé" (après confirmé) et "contrôle final" (avant véhicule prêt).
-- ALTER TYPE ... ADD VALUE est une opération additive : ne modifie ni ne
-- supprime aucune valeur existante, aucun risque pour les données actuelles.
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'dropped_off' BEFORE 'in_progress';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'final_check' BEFORE 'ready';
