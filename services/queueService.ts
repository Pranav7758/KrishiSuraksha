const QUEUE_KEY = 'offline_advisory_queue';

export interface QueuedRequest {
  id: string;
  timestamp: number;
  data: {
    crop: string;
    stage: string;
    soil: string;
  };
}

export const addToQueue = (data: QueuedRequest['data']) => {
  const queue = getQueue();
  const newItem: QueuedRequest = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    data
  };
  queue.push(newItem);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return newItem;
};

export const getQueue = (): QueuedRequest[] => {
  try {
    const item = localStorage.getItem(QUEUE_KEY);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    return [];
  }
};

export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};

export const removeFromQueue = (id: string) => {
  const queue = getQueue();
  const newQueue = queue.filter(item => item.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
};