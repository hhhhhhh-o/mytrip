export type TripItemKind = 'transport' | 'stay' | 'activity' | 'place';
export type TripItemFlexibility = 'fixed' | 'flexible';
export type TripItemState = 'candidate' | 'confirmed' | 'locked' | 'completed';

export interface SourceReference {
  id: string;
  type: 'screenshot' | 'link' | 'text' | 'manual' | 'map';
  provider?: string;
  label: string;
}

export interface ItineraryItem {
  id: string;
  kind: TripItemKind;
  flexibility: TripItemFlexibility;
  state: TripItemState;
  title: string;
  subtitle?: string;
  notes?: string;
  startsAt: string;
  endsAt?: string;
  timeTBD?: boolean;
  location?: string;
  source?: SourceReference;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startsOn: string;
  endsOn: string;
  status: 'draft' | 'upcoming' | 'active' | 'completed';
  items: ItineraryItem[];
}
