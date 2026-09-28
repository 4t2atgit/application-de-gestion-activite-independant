import { DashboardClientShare, DashboardMonthlyPoint, DashboardStats, Encaissement, Facture, Heure } from '../types';
import { listClients } from './clientService';
import { countFacturesEnRetard, getChiffreAffairesAnnuel, listFactures } from './factureService';
import { listHeures } from './heuresService';
import { listEncaissements } from './encaissementService';
import { getIssuerProfile } from './issuerService';
import { getFraisCeMois } from './fraisService';

/** Nombre de mois glissants affichés dans le graphique d'évolution du dashboard. */
const EVOLUTION_WINDOW_SIZE = 12;

function currentMonthToken(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentMonth(value: string): boolean {
  return value.slice(0, 7) === currentMonthToken();
}

/** Liste, du plus ancien au plus récent, les `size` derniers mois se terminant par le mois `anchor` (inclus). */
function rollingMonthWindow(size: number, anchor: Date): string[] {
  const months: string[] = [];
  for (let offset = size - 1; offset >= 0; offset -= 1) {
    let month = anchor.getMonth() - offset;
    let year = anchor.getFullYear();
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    months.push(`${year}-${String(month + 1).padStart(2, '0')}`);
  }
  return months;
}

/** Mois `AAAA-MM` de l'activité la plus récente, ou le mois courant si aucune activité n'est enregistrée. */
function latestActivityMonthToken(heures: Heure[]): string {
  const latest = heures.reduce((max, heure) => (heure.date > max ? heure.date : max), '');
  return latest ? latest.slice(0, 7) : currentMonthToken();
}

function monthTokenToDate(monthToken: string): Date {
  const [year, month] = monthToken.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, 1);
}

function buildEvolutionMensuelle(heures: Heure[], factures: Facture[], encaissements: Encaissement[]): DashboardMonthlyPoint[] {
  const anchorMonth = monthTokenToDate(latestActivityMonthToken(heures));
  const months = rollingMonthWindow(EVOLUTION_WINDOW_SIZE, anchorMonth);
  const encaisseParFacture = new Map<string, number>();
  for (const encaissement of encaissements) {
    encaisseParFacture.set(encaissement.facture_id, (encaisseParFacture.get(encaissement.facture_id) ?? 0) + encaissement.montant);
  }

  return months.map((mois) => {
    const facturesDuMois = factures.filter((facture) => facture.mois_facture === mois);
    const montantFacture = Number.parseFloat(
      facturesDuMois.reduce((total, facture) => total + facture.montant_ht, 0).toFixed(2),
    );
    // Part déjà réglée des factures de ce mois, quelle que soit la date de l'encaissement.
    const montantFactureEncaisse = Number(
      Math.min(
        montantFacture,
        facturesDuMois.reduce((total, facture) => total + (encaisseParFacture.get(facture.id) ?? 0), 0),
      ).toFixed(2),
    );
    const montantFactureResteDu = Number(Math.max(0, montantFacture - montantFactureEncaisse).toFixed(2));

    return {
      mois,
      chiffreAffaires: Number.parseFloat(
        encaissements
          .filter((encaissement) => encaissement.date.slice(0, 7) === mois)
          .reduce((total, encaissement) => total + encaissement.montant, 0)
          .toFixed(2),
      ),
      montantFacture,
      montantFactureEncaisse,
      montantFactureResteDu,
      joursTravailles: Number.parseFloat(
        heures
          .filter((heure) => heure.date.slice(0, 7) === mois)
          .reduce((total, heure) => total + heure.duree, 0)
          .toFixed(2),
      ),
    };
  });
}

async function buildRepartitionParClient(): Promise<DashboardClientShare[]> {
  const [clients, factures] = await Promise.all([listClients(), listFactures()]);
  const montantParClient = new Map<string, number>();

  for (const facture of factures) {
    montantParClient.set(facture.client_id, (montantParClient.get(facture.client_id) ?? 0) + facture.montant_ht);
  }

  return Array.from(montantParClient.entries())
    .map(([clientId, montant]) => ({
      clientId,
      clientNom: clients.find((client) => client.id === clientId)?.nom ?? 'Client inconnu',
      montant: Number.parseFloat(montant.toFixed(2)),
    }))
    .filter((share) => share.montant > 0)
    .sort((a, b) => b.montant - a.montant);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [heures, factures, encaissements, repartitionParClient, facturesEnRetard, chiffreAffairesAnnuel, issuer, fraisCeMois] = await Promise.all([
    listHeures(),
    listFactures(),
    listEncaissements(),
    buildRepartitionParClient(),
    countFacturesEnRetard(),
    getChiffreAffairesAnnuel(),
    getIssuerProfile(),
    getFraisCeMois(),
  ]);
  const evolutionMensuelle = buildEvolutionMensuelle(heures, factures, encaissements);

  return {
    joursCeMois: Number.parseFloat(
      heures
        .filter((heure) => isCurrentMonth(heure.date))
        .reduce((total, heure) => total + heure.duree, 0)
        .toFixed(2),
    ),
    chiffreAffairesCeMois: Number.parseFloat(
      factures
        .filter((facture) => isCurrentMonth(facture.mois_facture))
        .reduce((total, facture) => total + facture.montant_ht, 0)
        .toFixed(2),
    ),
    facturesEnAttente: factures.filter((facture) => facture.statut !== 'payée').length,
    facturesEnRetard,
    chiffreAffairesAnnuel,
    plafondAnnuel: issuer.plafond_annuel,
    fraisCeMois,
    evolutionMensuelle,
    repartitionParClient,
  };
}
