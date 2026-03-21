const SELECTED_EPISODE_KEY = 'moonaigc.imagegen.selectedEpisodeByProject'

type EpisodePrefMap = Record<string, string>

function readMap(): EpisodePrefMap {
  try {
    const raw = window.localStorage.getItem(SELECTED_EPISODE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as EpisodePrefMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: EpisodePrefMap) {
  try {
    window.localStorage.setItem(SELECTED_EPISODE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function getPreferredEpisodeId(projectId: string): string | null {
  return readMap()[projectId] ?? null
}

export function setPreferredEpisodeId(projectId: string, episodeId: string) {
  const map = readMap()
  map[projectId] = episodeId
  writeMap(map)
}
