export interface Advancement {
  parent?: string;
  criteria: {
    [key: string]: {
      trigger: string;
      conditions?: Record<string, any>;
    };
  };
  sends_telemetry_event: boolean;
  requirements: string[][];
  rewards?: {
    experience: number;
  };
  display: {
    description: {
      translate: string;
    };
    frame?: string;
    icon: {
      count: number;
      id: string;
      components?: Record<string, any>;
    };
    title: {
      translate: string;
    };
    hidden?: boolean;
    announce_to_chat?: boolean;
    background?: string;
    show_toast?: boolean;
  };
}
