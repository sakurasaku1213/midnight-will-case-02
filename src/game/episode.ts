import episodeData from '../../data/episode-02.json';
import { hydrateEpisodeAssets } from './assets';
import type { Episode } from './types';

export const episode = hydrateEpisodeAssets(episodeData as Episode);
