import type { IconProps as TablerIconProps, TablerIcon } from "@tabler/icons-react";
import {
  IconAccessible,
  IconActivityHeartbeat,
  IconAdjustmentsHorizontal,
  IconAerialLift,
  IconAirConditioning,
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconArmchair,
  IconArrowBigDown,
  IconArrowBigUp,
  IconArrowDown,
  IconArrowRight,
  IconArrowsUpDown,
  IconArrowUpRight,
  IconBabyCarriage,
  IconBath,
  IconBeach,
  IconBed,
  IconBlind,
  IconBriefcase2,
  IconBuildingBank,
  IconBuildingCastle,
  IconBuildingCommunity,
  IconBuildingEstate,
  IconBus,
  IconCake,
  IconCalendarEvent,
  IconCamera,
  IconCar,
  IconCaravan,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconCircleKey,
  IconCirclePlus,
  IconCircleX,
  IconClipboardList,
  IconClockHour3,
  IconCloudUpload,
  IconCoffee,
  IconCompass,
  IconCopy,
  IconCreditCard,
  IconCurrentLocation,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconDeviceTv,
  IconDoorEnter,
  IconEyeglass,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconFlag,
  IconFlame,
  IconFridge,
  IconGenderFemale,
  IconGenderMale,
  IconGlassCocktail,
  IconGlassFull,
  IconGlobe,
  IconHeart,
  IconHelpCircle,
  IconHome2,
  IconHomeHeart,
  IconInfoCircle,
  IconLanguage,
  IconLamp,
  IconLayoutBoardSplit,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLayoutRows,
  IconListCheck,
  IconLoader2,
  IconLock,
  IconLogout,
  IconMail,
  IconMap,
  IconMapPin,
  IconMenu,
  IconMessage2,
  IconMessageCircle,
  IconMessageDots,
  IconMessages,
  IconMoon,
  IconMountain,
  IconParkingCircle,
  IconPaw,
  IconPencil,
  IconPhone,
  IconPhoto,
  IconPhotoVideo,
  IconPlugConnected,
  IconPlus,
  IconPhotoOff,
  IconPropeller,
  IconRefresh,
  IconRosetteDiscountCheck,
  IconRotateClockwise2,
  IconRoute,
  IconRulerMeasure,
  IconSend2,
  IconShieldCheck,
  IconShip,
  IconShoe,
  IconShirt,
  IconShoppingBag,
  IconSearch,
  IconSmokingNo,
  IconSpeakerphone,
  IconSparkles,
  IconStar,
  IconSunrise,
  IconSunset,
  IconTent,
  IconThumbDown,
  IconThumbUp,
  IconToiletPaper,
  IconToolsKitchen2,
  IconTrash,
  IconTrees,
  IconUser,
  IconUserCheck,
  IconUserCircle,
  IconUsers,
  IconUsb,
  IconWallet,
  IconWashMachine,
  IconWifi,
  IconWindow,
  IconWind,
  IconWorld,
  IconX,
  IconHeadset,
  IconMoodSmile,
  IconPaperclip,
} from "@tabler/icons-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

export type LucideProps = Omit<TablerIconProps, "stroke"> & {
  stroke?: TablerIconProps["stroke"];
  strokeWidth?: TablerIconProps["stroke"];
  absoluteStrokeWidth?: boolean;
};

export type LucideIcon = ForwardRefExoticComponent<
  LucideProps & RefAttributes<SVGSVGElement>
>;

const asLucideIcon = (icon: TablerIcon): LucideIcon => icon as unknown as LucideIcon;

export const Accessibility = asLucideIcon(IconAccessible);
export const AirVent = asLucideIcon(IconAirConditioning);
export const Archive = asLucideIcon(IconArchive);
export const Armchair = asLucideIcon(IconArmchair);
export const ArrowBigDown = asLucideIcon(IconArrowBigDown);
export const ArrowBigUp = asLucideIcon(IconArrowBigUp);
export const ArrowDown = asLucideIcon(IconArrowDown);
export const ArrowRight = asLucideIcon(IconArrowRight);
export const ArrowUpDown = asLucideIcon(IconArrowsUpDown);
export const ArrowUpRight = asLucideIcon(IconArrowUpRight);
export const AudioLines = asLucideIcon(IconSpeakerphone);
export const Baby = asLucideIcon(IconBabyCarriage);
export const BadgeCheck = asLucideIcon(IconRosetteDiscountCheck);
export const BarChart3 = asLucideIcon(IconChartBar);
export const Bath = asLucideIcon(IconBath);
export const BedDouble = asLucideIcon(IconBed);
export const Blinds = asLucideIcon(IconBlind);
export const BriefcaseBusiness = asLucideIcon(IconBriefcase2);
export const Building2 = asLucideIcon(IconBuildingCommunity);
export const Bus = asLucideIcon(IconBus);
export const CableCar = asLucideIcon(IconAerialLift);
export const CakeSlice = asLucideIcon(IconCake);
export const CalendarDays = asLucideIcon(IconCalendarEvent);
export const Camera = asLucideIcon(IconCamera);
export const Car = asLucideIcon(IconCar);
export const Castle = asLucideIcon(IconBuildingCastle);
export const Check = asLucideIcon(IconCheck);
export const ChevronDown = asLucideIcon(IconChevronDown);
export const ChevronLeft = asLucideIcon(IconChevronLeft);
export const ChevronRight = asLucideIcon(IconChevronRight);
export const ChevronUp = asLucideIcon(IconChevronUp);
export const CigaretteOff = asLucideIcon(IconSmokingNo);
export const CircleAlert = asLucideIcon(IconAlertCircle);
export const CircleCheckBig = asLucideIcon(IconCircleCheck);
export const CircleHelp = asLucideIcon(IconHelpCircle);
export const CircleParking = asLucideIcon(IconParkingCircle);
export const CirclePlus = asLucideIcon(IconCirclePlus);
export const CircleX = asLucideIcon(IconCircleX);
export const ClipboardList = asLucideIcon(IconClipboardList);
export const Clock3 = asLucideIcon(IconClockHour3);
export const CloudUpload = asLucideIcon(IconCloudUpload);
export const Coffee = asLucideIcon(IconCoffee);
export const Compass = asLucideIcon(IconCompass);
export const Copy = asLucideIcon(IconCopy);
export const CookingPot = asLucideIcon(IconToolsKitchen2);
export const CreditCard = asLucideIcon(IconCreditCard);
export const DoorOpen = asLucideIcon(IconDoorEnter);
export const Eye = asLucideIcon(IconEye);
export const EyeOff = asLucideIcon(IconEyeOff);
export const Fan = asLucideIcon(IconPropeller);
export const FileText = asLucideIcon(IconFileText);
export const Flag = asLucideIcon(IconFlag);
export const Flame = asLucideIcon(IconFlame);
export const Footprints = asLucideIcon(IconShoe);
export const GlassWater = asLucideIcon(IconGlassFull);
export const Glasses = asLucideIcon(IconEyeglass);
export const Globe = asLucideIcon(IconGlobe);
export const Globe2 = asLucideIcon(IconWorld);
export const Heart = asLucideIcon(IconHeart);
export const HeartPulse = asLucideIcon(IconActivityHeartbeat);
export const Hotel = asLucideIcon(IconBuildingEstate);
export const House = asLucideIcon(IconHome2);
export const HouseHeart = asLucideIcon(IconHomeHeart);
export const Image = asLucideIcon(IconPhoto);
export const Images = asLucideIcon(IconPhoto);
export const ImageOff = asLucideIcon(IconPhotoOff);
export const Info = asLucideIcon(IconInfoCircle);
export const KeyRound = asLucideIcon(IconCircleKey);
export const LampDesk = asLucideIcon(IconLamp);
export const Landmark = asLucideIcon(IconBuildingBank);
export const Languages = asLucideIcon(IconLanguage);
export const LayoutDashboard = asLucideIcon(IconLayoutDashboard);
export const LayoutGrid = asLucideIcon(IconLayoutGrid);
export const ListChecks = asLucideIcon(IconListCheck);
export const LoaderCircle = asLucideIcon(IconLoader2);
export const LocateFixed = asLucideIcon(IconCurrentLocation);
export const LockKeyhole = asLucideIcon(IconLock);
export const LogOut = asLucideIcon(IconLogout);
export const Mail = asLucideIcon(IconMail);
export const Map = asLucideIcon(IconMap);
export const MapPin = asLucideIcon(IconMapPin);
export const Menu = asLucideIcon(IconMenu);
export const MessageCircle = asLucideIcon(IconMessageCircle);
export const MessageCircleMore = asLucideIcon(IconMessageDots);
export const MessageSquare = asLucideIcon(IconMessage2);
export const MessageSquareText = asLucideIcon(IconMessage2);
export const MessagesSquare = asLucideIcon(IconMessages);
export const Monitor = asLucideIcon(IconDeviceDesktop);
export const Moon = asLucideIcon(IconMoon);
export const Mountain = asLucideIcon(IconMountain);
export const PanelsTopLeft = asLucideIcon(IconWindow);
export const PawPrint = asLucideIcon(IconPaw);
export const PenLine = asLucideIcon(IconPencil);
export const Phone = asLucideIcon(IconPhone);
export const PlugZap = asLucideIcon(IconPlugConnected);
export const Plus = asLucideIcon(IconPlus);
export const RefreshCw = asLucideIcon(IconRefresh);
export const Refrigerator = asLucideIcon(IconFridge);
export const RotateCw = asLucideIcon(IconRotateClockwise2);
export const Route = asLucideIcon(IconRoute);
export const Rows3 = asLucideIcon(IconLayoutRows);
export const RulerDimensionLine = asLucideIcon(IconRulerMeasure);
export const Save = asLucideIcon(IconDeviceFloppy);
export const Search = asLucideIcon(IconSearch);
export const SendHorizontal = asLucideIcon(IconSend2);
export const ShieldCheck = asLucideIcon(IconShieldCheck);
export const Ship = asLucideIcon(IconShip);
export const Shirt = asLucideIcon(IconShirt);
export const ShoppingBag = asLucideIcon(IconShoppingBag);
export const ShowerHead = asLucideIcon(IconBath);
export const SlidersHorizontal = asLucideIcon(IconAdjustmentsHorizontal);
export const Sparkles = asLucideIcon(IconSparkles);
export const SquareChartGantt = asLucideIcon(IconLayoutBoardSplit);
export const Star = asLucideIcon(IconStar);
export const Sunrise = asLucideIcon(IconSunrise);
export const Sunset = asLucideIcon(IconSunset);
export const TentTree = asLucideIcon(IconTent);
export const ThumbsDown = asLucideIcon(IconThumbDown);
export const ThumbsUp = asLucideIcon(IconThumbUp);
export const Toilet = asLucideIcon(IconToiletPaper);
export const Trash2 = asLucideIcon(IconTrash);
export const Trees = asLucideIcon(IconTrees);
export const TriangleAlert = asLucideIcon(IconAlertTriangle);
export const Tv = asLucideIcon(IconDeviceTv);
export const TvMinimalPlay = asLucideIcon(IconPhotoVideo);
export const Usb = asLucideIcon(IconUsb);
export const GenderFemale = asLucideIcon(IconGenderFemale);
export const GenderMale = asLucideIcon(IconGenderMale);
export const User = asLucideIcon(IconUser);
export const UserCheck = asLucideIcon(IconUserCheck);
export const UserRound = asLucideIcon(IconUserCircle);
export const Users = asLucideIcon(IconUsers);
export const UtensilsCrossed = asLucideIcon(IconToolsKitchen2);
export const Van = asLucideIcon(IconCaravan);
export const WalletCards = asLucideIcon(IconWallet);
export const WashingMachine = asLucideIcon(IconWashMachine);
export const Waves = asLucideIcon(IconBeach);
export const Wifi = asLucideIcon(IconWifi);
export const Wind = asLucideIcon(IconWind);
export const Wine = asLucideIcon(IconGlassCocktail);
export const X = asLucideIcon(IconX);
export const Headset = asLucideIcon(IconHeadset);
export const Send = asLucideIcon(IconSend2);
export const Paperclip = asLucideIcon(IconPaperclip);
export const Smile = asLucideIcon(IconMoodSmile);
export const Loader2 = asLucideIcon(IconLoader2);
export const UserCircle = asLucideIcon(IconUserCircle);
export const Pencil = asLucideIcon(IconPencil);
export const ImageIcon = asLucideIcon(IconPhoto);
