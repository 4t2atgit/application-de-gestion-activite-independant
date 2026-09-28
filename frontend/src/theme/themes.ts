export interface ThemeDefinition {
  id: string;
  label: string;
}

/**
 * Registre des thèmes disponibles dans l'application. Pour ajouter un thème,
 * ajouter une entrée ici avec un id correspondant à un bloc
 * `[data-theme="<id>"]` défini dans `src/styles/themes.css`.
 */
export const themes: ThemeDefinition[] = [
  { id: 'clair', label: 'Thème clair' },
  { id: 'sombre', label: 'Thème sombre' },
];

export const defaultThemeId = themes[0].id;

export function isKnownThemeId(value: string | null): value is string {
  return value !== null && themes.some((theme) => theme.id === value);
}
