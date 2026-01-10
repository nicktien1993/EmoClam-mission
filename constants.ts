
import { Card, EmotionOption, NeedOption } from './types';

export const SCHOOL_CARDS: Card[] = [
  { id: 's1', type: '安全', cn: '老師給我一張好寶寶貼紙！', icon: 'Star' },
  { id: 's2', type: '安全', cn: '下課和好朋友玩鬼抓人！', icon: 'Activity' },
  { id: 's3', type: '危險', cn: '找不到我的橡皮擦...', icon: 'Eraser' },
  { id: 's4', type: '危險', cn: '同學弄倒我的水壺，濕濕的...', icon: 'Droplets' },
  { id: 's5', type: '危險', cn: '好朋友今天不想跟我玩...', icon: 'UserX' },
  { id: 's6', type: '危險', cn: '上台說話的時候忘記要說什麼...', icon: 'MicOff' },
  { id: 's7', type: '安全', cn: '今天午餐有我最喜歡的雞塊！', icon: 'Utensils' },
  { id: 's8', type: '安全', cn: '體育課賽跑拿到第一名！', icon: 'Rocket' },
  { id: 's9', type: '危險', cn: '這題數學好難，我算不出來...', icon: 'ZapOff' },
  { id: 's10', type: '危險', cn: '排隊的時候有人插隊！', icon: 'AlertTriangle' },
  { id: 's11', type: '危險', cn: '畫畫課的時候彩色筆沒水了...', icon: 'PenTool' },
  { id: 's12', type: '安全', cn: '幫老師拿東西被誇獎了。', icon: 'CheckCircle2' },
  { id: 's13', type: '安全', cn: '自然課觀察豆子發芽了！', icon: 'Cloud' },
  { id: 's14', type: '危險', cn: '我的彩色筆被同學用斷了...', icon: 'HeartCrack' },
  { id: 's15', type: '安全', cn: '今天有我最喜歡的社團活動。', icon: 'Music' },
];

export const HOME_CARDS: Card[] = [
  { id: 'h1', type: '安全', cn: '晚餐吃咖哩飯！', icon: 'Utensils' },
  { id: 'h2', type: '安全', cn: '媽媽念故事書給我聽。', icon: 'BookOpen' },
  { id: 'h3', type: '危險', cn: '弟弟搶我的玩具還打人！', icon: 'Hand' },
  { id: 'h4', type: '危險', cn: '媽媽說不能看電視了...', icon: 'Tv' },
  { id: 'h5', type: '危險', cn: '打破杯子了，怕被罵...', icon: 'GlassWater' },
  { id: 'h6', type: '安全', cn: '今天可以穿我最喜歡的衣服！', icon: 'Heart' },
  { id: 'h7', type: '安全', cn: '洗了一個香噴噴的熱水澡。', icon: 'Droplets' },
  { id: 'h8', type: '危險', cn: '積木城堡被我不小心撞倒了...', icon: 'Zap' },
  { id: 'h9', type: '危險', cn: '天黑了，覺得房間裡有怪獸...', icon: 'CloudLightning' },
  { id: 'h10', type: '危險', cn: '我想吃糖果，但爸爸說不行...', icon: 'Frown' },
  { id: 'h11', type: '安全', cn: '跟爸爸一起去公園騎腳踏車。', icon: 'Activity' },
  { id: 'h12', type: '安全', cn: '拼圖終於拼完了，好有成就感！', icon: 'Trophy' },
  { id: 'h13', type: '危險', cn: '最喜歡的小被被在洗澡不能抱...', icon: 'Cloud' },
  { id: 'h14', type: '安全', cn: '睡覺前和爸爸媽媽抱抱。', icon: 'Heart' },
  { id: 'h15', type: '安全', cn: '今天學會自己整理書包！', icon: 'CheckCircle2' },
];

export const BOSS_CARDS: Card[] = [
  { id: 'b1', type: '危險', isBoss: true, cn: '打雷了！好大聲好可怕！', icon: 'CloudLightning' },
  { id: 'b2', type: '危險', isBoss: true, cn: '跟最好的朋友吵架，他不理我了！', icon: 'HeartCrack' },
  { id: 'b3', type: '危險', isBoss: true, cn: '最重要的寶貝弄丟了，找不到了！', icon: 'Trash2' },
];

export const EMOTIONS: EmotionOption[] = [
  { id: 'angry', cn: '很生氣', icon: 'Flame' },
  { id: 'sad', cn: '好難過', icon: 'Frown' },
  { id: 'scared', cn: '很害怕', icon: 'AlertTriangle' },
  { id: 'worried', cn: '好擔心', icon: 'Cloud' },
  { id: 'nervous', cn: '太緊張', icon: 'Zap' },
  { id: 'other', cn: '不舒服', icon: 'HelpCircle' },
];

export const NEEDS: NeedOption[] = [
  { id: 'hug', cn: '想要抱抱', icon: 'Heart' },
  { id: 'water', cn: '喝一口水', icon: 'Droplets' },
  { id: 'base', cn: '去秘密基地', icon: 'Shield' },
  { id: 'draw', cn: '畫畫寫字', icon: 'PenTool' },
  { id: 'music', cn: '聽輕音樂', icon: 'Music' },
  { id: 'move', cn: '動一動身體', icon: 'Activity' },
];
