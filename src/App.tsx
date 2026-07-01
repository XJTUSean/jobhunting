import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
import { auth, db } from "./firebase";
import "./App.css";
import jobflowLogo from "../assets/jobflow.png";
import personalMaterialsIcon from "../assets/01_personal_materials.png";
void personalMaterialsIcon;
import selfAnalysisIcon from "../assets/02_self_analysis.png";
import interviewQuestionsIcon from "../assets/03_interview_questions.png";
import esEntrySheetIcon from "../assets/04_es_entry_sheet.png";
import companyResearchIcon from "../assets/05_company_research.png";
import jobTypeResearchIcon from "../assets/06_job_type_research.png";
import selfPrMaterialIcon from "../assets/07_self_pr_material_library.png";
import gakuchikaMaterialIcon from "../assets/08_gakuchika_material_library.png";
import researchDescriptionIcon from "../assets/09_research_description.png";
import setbackFailureIcon from "../assets/10_setback_failure_experience_material_library.png";
import reverseQuestionsIcon from "../assets/11_reverse_questions.png";
import selfIntroductionIcon from "../assets/12_self_introduction.png";
import jobHuntingAxisIcon from "../assets/13_job_hunting_axis.png";

type Priority = "high" | "middle" | "low";
type CompanyStatus = "active" | "waiting" | "passed" | "rejected" | "declined";
type FlowStatus = "done" | "current" | "todo" | "failed";
type TimeMode = "none" | "deadline" | "schedule";
type AppPage = "companies" | "calendar" | "materials" | "backup";
type CompanyGroupKey = "todo" | "waiting" | "finished";


type MaterialCategory = string;

type MaterialFolder = {
  id: string;
  value: MaterialCategory;
  label: string;
  description: string;
  icon?: string;
  order: number;
  createdAt?: any;
  updatedAt?: any;
};

type TextMaterial = {
  id: string;
  title: string;
  category: MaterialCategory;
  subcategory: string;
  body: string;
  companyName: string;
  memo: string;
  createdAt?: any;
  updatedAt?: any;
};

type TextMaterialForm = {
  title: string;
  category: MaterialCategory;
  subcategory: string;
  body: string;
  companyName: string;
  memo: string;
};

type MaterialSubcategory = {
  id: string;
  parentCategory: MaterialCategory;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

type PersonalMaterialKind = string;

type PersonalMaterialCategory = {
  id: string;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

type PersonalMaterialFile = {
  id: string;
  name: string;
  fileUrl: string;
  kind: PersonalMaterialKind;
  memo: string;
  createdAt?: any;
  updatedAt?: any;
};

type CalendarEventDetail = {
  companyName: string;
  itemTitle: string;
  mode: "deadline" | "schedule";
  startText: string;
  endText: string;
  location: string;
  url: string;
  memo: string;
};

type CurrentActionItem = {
  id: string;
  companyName: string;
  itemTitle: string;
  mode: "deadline" | "schedule";
  targetTime: string;
  endTime: string;
  location: string;
  url: string;
  memo: string;
  sortTime: number;
  groupLabel: string;
};

type FlowItem = {
  id: number;
  title: string;
  status: FlowStatus;
  timeMode: TimeMode;
  deadline: string;
  start: string;
  end: string;
  location: string;
  url: string;
  memo: string;
};

type Company = {
  id: string;
  name: string;
  position: string;
  priority: Priority;
  status: CompanyStatus;
  myPageUrl?: string;
  loginId?: string;
  loginPassword?: string;
  memo?: string;
  flowItems: FlowItem[];
};

type CompanyMail = {
  id: string;
  subject: string;
  body: string;
  createdAt?: any;
  updatedAt?: any;
};

type CompanyMailForm = {
  subject: string;
  body: string;
};

type CompanyForm = {
  name: string;
  position: string;
  priority: Priority;
  myPageUrl: string;
  loginId: string;
  loginPassword: string;
  memo: string;
  flowItems: FlowItem[];
};

type OldStep = {
  id?: number;
  name?: string;
  status?: string;
};

type OldEvent = {
  id?: number;
  title?: string;
  start?: string;
  end?: string;
  memo?: string;
};

type OldCurrentTask = {
  title?: string;
  timeMode?: string;
  deadline?: string;
  start?: string;
  end?: string;
  memo?: string;
  status?: string;
};

type OldTask = {
  id?: number;
  title?: string;
  timeMode?: string;
  deadline?: string;
  start?: string;
  end?: string;
  memo?: string;
  status?: string;
};

const createEmptyForm = (): CompanyForm => ({
  name: "",
  position: "",
  priority: "middle",
  myPageUrl: "",
  loginId: "",
  loginPassword: "",
  memo: "",
  flowItems: [],
});

const createEmptyFlowItem = (): FlowItem => ({
  id: Date.now(),
  title: "",
  status: "todo",
  timeMode: "none",
  deadline: "",
  start: "",
  end: "",
  location: "",
  url: "",
  memo: "",
});

const createEmptyCompanyMailForm = (): CompanyMailForm => ({
  subject: "",
  body: "",
});

function cleanCompanyMailText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "　")
    .replace(/\u00A0/g, " ")
    .replace(/[ ]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function isMailSeparatorLine(line: string) {
  return /^[-ー－―─]{8,}$/.test(line.trim());
}

function isMailSectionHeading(line: string) {
  const trimmed = line.trim();
  return /^＜.+＞$/.test(trimmed) || /^【.+】$/.test(trimmed);
}

function renderMailLineWithLinks(line: string) {
  const parts = line.split(/(https?:\/\/[^\s　]+)/g);

  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderCompanyMailBody(body: string) {
  const lines = cleanCompanyMailText(body).split("\n");

  return lines.map((line, index) => {
    if (line.trim() === "") {
      return <div className="company-mail-body-blank" key={`blank-${index}`} />;
    }

    if (isMailSeparatorLine(line)) {
      return <div className="company-mail-separator" key={`separator-${index}`} />;
    }

    if (isMailSectionHeading(line)) {
      return (
        <div className="company-mail-section-heading" key={`heading-${index}`}>
          {line.trim()}
        </div>
      );
    }

    return (
      <div className="company-mail-body-line" key={`line-${index}`}>
        {renderMailLineWithLinks(line.trimStart())}
      </div>
    );
  });
}


function restoreBackupTimestamp(value: any) {
  if (!value) return serverTimestamp();

  if (typeof value.toDate === "function") return value;

  if (typeof value.seconds === "number") {
    const nanoseconds =
      typeof value.nanoseconds === "number" ? value.nanoseconds : 0;
    return new Timestamp(value.seconds, nanoseconds);
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }

  return value;
}

function removeUndefinedFields<T extends Record<string, any>>(value: T) {
  const cleaned: Record<string, any> = {};

  Object.entries(value).forEach(([key, fieldValue]) => {
    if (fieldValue !== undefined) {
      cleaned[key] = fieldValue;
    }
  });

  return cleaned;
}

function normalizeBackupArray(value: any) {
  return Array.isArray(value) ? value : [];
}


function isEmptyTextMaterialContent(material: Pick<TextMaterial, "title" | "body" | "memo">) {
  return (
    !String(material.title ?? "").trim() &&
    !String(material.body ?? "").trim() &&
    !String(material.memo ?? "").trim()
  );
}


const materialCategoryOptions: {
  value: MaterialCategory;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: "self_analysis", label: "自我分析", description: "性格、价值观、强项弱项、经验整理", icon: selfAnalysisIcon },
  { value: "interview_questions", label: "面试问题集", description: "面试问题集与回答", icon: interviewQuestionsIcon },
  { value: "es", label: "ES", description: "ES 答案、志望动机、公司别提交稿", icon: esEntrySheetIcon },
  { value: "company_research", label: "企业研究表", description: "企业业务、强项、竞合、志望理由素材", icon: companyResearchIcon },
  { value: "job_type_research", label: "职种研究表", description: "生产技术、开发、SE 等职种理解", icon: jobTypeResearchIcon },
  { value: "self_pr", label: "自己PR素材库", description: "强项、理由、具体例、学到的东西", icon: selfPrMaterialIcon },
  { value: "gakuchika", label: "ガクチカ素材库", description: "学生时代努力过的事、STAR 结构素材", icon: gakuchikaMaterialIcon },
  { value: "research_content", label: "研究内容说明", description: "研究概要、难点、方法、成果、意义", icon: researchDescriptionIcon },
  { value: "failure_experience", label: "挫折・失败经历素材库", description: "失败经验、改善行动、学到的教训", icon: setbackFailureIcon },
  { value: "reverse_questions", label: "逆質問问题集", description: "把想问的问题作为标题，正文保存补充说明", icon: reverseQuestionsIcon },
  { value: "self_introduction", label: "自我介绍", description: "30 秒、1 分钟、日语/中文自我介绍", icon: selfIntroductionIcon },
  { value: "career_axis", label: "就活轴", description: "选公司标准、行业偏好、职业目标", icon: jobHuntingAxisIcon },
];

const DEFAULT_PERSONAL_MATERIAL_CATEGORY = "其他";

const companyGroupDefinitions: {
  key: CompanyGroupKey;
  label: string;
  description: string;
}[] = [
  { key: "todo", label: "待办", description: "正在进行，需要你主动处理下一件事的公司。" },
  { key: "waiting", label: "等待结果中", description: "当前阶段已完成，正在等待结果的公司。" },
  { key: "finished", label: "结束", description: "已经拿到 offer、落选或主动辞退的公司。" },
];

function getCompanyGroupKey(status: CompanyStatus): CompanyGroupKey {
  if (status === "active") return "todo";
  if (status === "waiting") return "waiting";
  return "finished";
}

const legacyPersonalMaterialKindLabels: Record<string, string> = {
  photo: "照片 / 图片",
  resume: "履历书 / 简历",
  certificate: "证明材料",
  portfolio: "作品集 / 其他提交材料",
  other: "其他",
};

const createEmptyTextMaterialForm = (
  category: MaterialCategory = "self_analysis",
): TextMaterialForm => ({
  title: "",
  category,
  subcategory: "其他",
  body: "",
  companyName: "",
  memo: "",
});

function getMaterialCategoryLabel(category: MaterialCategory) {
  return (
    materialCategoryOptions.find((item) => item.value === category)?.label ??
    (category || "其他")
  );
}

function normalizePersonalMaterialKind(value: string | undefined): PersonalMaterialKind {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_PERSONAL_MATERIAL_CATEGORY;

  return legacyPersonalMaterialKindLabels[trimmed] ?? trimmed;
}

function getPersonalMaterialKindLabel(kind: PersonalMaterialKind) {
  return normalizePersonalMaterialKind(kind);
}

function normalizeMaterialFileUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}


function normalizeSubcategoryName(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || "其他";
}

function normalizeMaterialCategory(value: string | undefined): MaterialCategory {
  const trimmed = (value ?? "").trim();

  if (trimmed === "interview") return "interview_questions";
  if (trimmed === "motivation") return "es";
  if (trimmed === "reverse_question") return "reverse_questions";
  if (trimmed === "research") return "research_content";

  return trimmed || "self_analysis";
}

function formatFirestoreDate(value: any) {
  if (!value) return "";

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  return formatDateTime(String(value));
}


function escapePrintHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHighlightedHtml(value: string, keyword: string) {
  const safeValue = escapePrintHtml(value || "").replace(/\n/g, "<br />");
  const safeKeyword = keyword.trim();

  if (!safeKeyword) return safeValue;

  const escapedKeyword = safeKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedKeyword, "gi");

  return safeValue.replace(regex, (match) => `<mark class="word-search-highlight">${match}</mark>`);
}

function placeCaretAtEnd(element: HTMLElement) {
  const range = document.createRange();
  const selection = window.getSelection();

  range.selectNodeContents(element);
  range.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function WordEditableText(props: {
  value: string;
  className: string;
  placeholder: string;
  searchKeyword: string;
  onChange: (value: string) => void;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const composingRef = useRef(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    if (focusedRef.current || composingRef.current) return;

    element.innerHTML = buildHighlightedHtml(props.value, props.searchKeyword);
  }, [props.value, props.searchKeyword]);

  const readText = () => elementRef.current?.innerText.replace(/\n$/, "") ?? "";

  return (
    <div
      ref={elementRef}
      className={props.className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={props.placeholder}
      onFocus={() => {
        focusedRef.current = true;
        const element = elementRef.current;
        if (!element) return;
        element.textContent = props.value || "";
        window.setTimeout(() => placeCaretAtEnd(element), 0);
      }}
      onBlur={() => {
        focusedRef.current = false;
        const nextValue = readText();
        props.onChange(nextValue);

        const element = elementRef.current;
        if (element) {
          element.innerHTML = buildHighlightedHtml(nextValue, props.searchKeyword);
        }
      }}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={() => {
        composingRef.current = false;
        props.onChange(readText());
      }}
      onInput={() => {
        if (composingRef.current) return;
        props.onChange(readText());
      }}
    />
  );
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "登录或注册失败";

  if (error.message.includes("auth/email-already-in-use")) {
    return "这个邮箱已经注册过了";
  }

  if (error.message.includes("auth/invalid-email")) {
    return "邮箱格式不正确";
  }

  if (error.message.includes("auth/weak-password")) {
    return "密码请设置为 6 位以上";
  }

  if (
    error.message.includes("auth/invalid-credential") ||
    error.message.includes("auth/user-not-found") ||
    error.message.includes("auth/wrong-password")
  ) {
    return "邮箱或密码不正确";
  }

  return "登录或注册失败";
}

function getPriorityLabel(priority: Priority) {
  if (priority === "high") return "高";
  if (priority === "middle") return "中";
  return "低";
}

function getStatusLabel(status: CompanyStatus) {
  if (status === "active") return "进行中";
  if (status === "waiting") return "等待结果";
  if (status === "passed") return "通过 / 内定";
  if (status === "rejected") return "落选";
  return "辞退";
}

function normalizeTimeMode(value: string | undefined): TimeMode {
  if (value === "none" || value === "deadline" || value === "schedule") {
    return value;
  }

  return "none";
}

function normalizeFlowStatus(value: string | undefined): FlowStatus {
  if (
    value === "done" ||
    value === "current" ||
    value === "todo" ||
    value === "failed"
  ) {
    return value;
  }

  if (value === "active" || value === "waiting") return "current";

  return "todo";
}

function getCurrentFlowIndex(items: FlowItem[]) {
  const currentIndex = items.findIndex((item) => item.status === "current");
  if (currentIndex >= 0) return currentIndex;

  const firstTodoIndex = items.findIndex((item) => item.status === "todo");
  if (firstTodoIndex >= 0) return firstTodoIndex;

  return items.length > 0 ? items.length - 1 : 0;
}

function getCurrentFlowItem(items: FlowItem[]) {
  if (items.length === 0) return null;
  return items[getCurrentFlowIndex(items)] ?? null;
}

function getNextFlowItem(items: FlowItem[]) {
  if (items.length === 0) return null;

  const currentIndex = getCurrentFlowIndex(items);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= items.length) return null;

  return items[nextIndex] ?? null;
}



function applyCurrentIndex(items: FlowItem[], currentIndex: number): FlowItem[] {
  return items.map((item, index) => ({
    ...item,
    status:
      index < currentIndex
        ? ("done" as FlowStatus)
        : index === currentIndex
          ? ("current" as FlowStatus)
          : ("todo" as FlowStatus),
  }));
}

function createDeclinedFlowItems(
  items: FlowItem[],
  companyStatus: CompanyStatus,
): FlowItem[] {
  const currentIndex = getCurrentFlowIndex(items);

  return items.map((item, index) => {
    const isAlreadyDone = item.status === "done";
    const isCompletedWaitingStage =
      companyStatus === "waiting" && index === currentIndex;

    return {
      ...item,
      status:
        index < currentIndex || isAlreadyDone || isCompletedWaitingStage
          ? ("done" as FlowStatus)
          : ("todo" as FlowStatus),
    };
  });
}

function normalizeCompanyFlowItems(
  items: FlowItem[],
  companyStatus: CompanyStatus,
): FlowItem[] {
  if (items.length === 0) return [];

  if (companyStatus === "passed") {
    return items.map((item) => ({ ...item, status: "done" as FlowStatus }));
  }

  if (companyStatus === "rejected") {
    const failedIndex = items.findIndex((item) => item.status === "failed");
    const currentIndex =
      failedIndex >= 0 ? failedIndex : getCurrentFlowIndex(items);

    return items.map((item, index) => {
      if (index < currentIndex)
        return { ...item, status: "done" as FlowStatus };
      if (index === currentIndex)
        return { ...item, status: "failed" as FlowStatus };
      return { ...item, status: "todo" as FlowStatus };
    });
  }

  if (companyStatus === "declined") {
    return items.map((item) => ({
      ...item,
      status: item.status === "done" ? ("done" as FlowStatus) : ("todo" as FlowStatus),
    }));
  }

  const currentIndex = getCurrentFlowIndex(items);
  return applyCurrentIndex(items, currentIndex);
}

function formatDateTime(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}


function getDateOnlyValue(value: string) {
  if (!value) return "";

  return value.slice(0, 10);
}

function formatTimeOnly(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const match = value.match(/T(\d{2}:\d{2})/);
    return match?.[1] ?? value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getActionGroupLabel(sortTime: number) {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
  const threeDaysLater = todayStart + 4 * 24 * 60 * 60 * 1000;
  const sevenDaysLater = todayStart + 8 * 24 * 60 * 60 * 1000;

  if (sortTime < now.getTime()) return "已逾期";
  if (sortTime < tomorrowStart) return "今天";
  if (sortTime < threeDaysLater) return "3 天内";
  if (sortTime < sevenDaysLater) return "7 天内";
  return "之后";
}

function getActionItemTime(item: FlowItem) {
  if (item.timeMode === "deadline" && item.deadline) {
    const date = new Date(item.deadline);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (item.timeMode === "schedule" && item.start) {
    const date = new Date(item.start);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeLoadedFlowItems(data: any): FlowItem[] {
  if (Array.isArray(data.flowItems) && data.flowItems.length > 0) {
    return data.flowItems.map((item: any, index: number) => ({
      id: item.id ?? Date.now() + index,
      title: item.title ?? item.name ?? "",
      status: normalizeFlowStatus(item.status),
      timeMode: normalizeTimeMode(item.timeMode),
      deadline: item.deadline ?? "",
      start: item.start ?? "",
      end: item.end ?? "",
      location: item.location ?? "",
      url: item.url ?? "",
      memo: item.memo ?? "",
    }));
  }

  if (data.currentTask) {
    const task: OldCurrentTask = data.currentTask;

    return [
      {
        id: Date.now(),
        title: task.title ?? "",
        status: data.status === "rejected" ? "failed" : "current",
        timeMode: normalizeTimeMode(task.timeMode),
        deadline: task.deadline ?? "",
        start: task.start ?? "",
        end: task.end ?? "",
        location: "",
        url: "",
        memo: task.memo ?? "",
      },
    ];
  }

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    return data.tasks.map((task: OldTask, index: number) => ({
      id: task.id ?? Date.now() + index,
      title: task.title ?? "",
      status: normalizeFlowStatus(task.status),
      timeMode: normalizeTimeMode(task.timeMode),
      deadline: task.deadline ?? "",
      start: task.start ?? "",
      end: task.end ?? "",
      location: "",
      url: "",
      memo: task.memo ?? "",
    }));
  }

  if (Array.isArray(data.events) && data.events.length > 0) {
    return data.events.map((event: OldEvent, index: number) => ({
      id: event.id ?? Date.now() + index,
      title: event.title ?? "",
      status: index === 0 ? "current" : "todo",
      timeMode: event.start ? "schedule" : "none",
      deadline: "",
      start: event.start ?? "",
      end: event.end ?? "",
      location: "",
      url: "",
      memo: event.memo ?? "",
    }));
  }

  if (Array.isArray(data.steps) && data.steps.length > 0) {
    return data.steps.map((step: OldStep, index: number) => ({
      id: step.id ?? Date.now() + index,
      title: step.name ?? "",
      status: normalizeFlowStatus(step.status),
      timeMode: "none",
      deadline: "",
      start: "",
      end: "",
      location: "",
      url: "",
      memo: "",
    }));
  }

  return [];
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [mailboxCompanyId, setMailboxCompanyId] = useState<string | null>(null);
  const [companyMails, setCompanyMails] = useState<CompanyMail[]>([]);
  const [companyMailsLoading, setCompanyMailsLoading] = useState(false);
  const [selectedCompanyMailId, setSelectedCompanyMailId] = useState<string | null>(null);
  const [isCompanyMailFormOpen, setIsCompanyMailFormOpen] = useState(false);
  const [companyMailForm, setCompanyMailForm] = useState<CompanyMailForm>(
    createEmptyCompanyMailForm,
  );

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(createEmptyForm);

  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<FlowItem | null>(null);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeCompanyGroupKey, setActiveCompanyGroupKey] =
    useState<CompanyGroupKey>("todo");
  const [activePage, setActivePage] = useState<AppPage>("companies");
  const [selectedCalendarEvent, setSelectedCalendarEvent] =
    useState<CalendarEventDetail | null>(null);

  const [textMaterials, setTextMaterials] = useState<TextMaterial[]>([]);
  const [textMaterialsLoading, setTextMaterialsLoading] = useState(false);
  const [inlineSavingMaterialIds, setInlineSavingMaterialIds] = useState<Record<string, boolean>>({});
  const inlineSaveTimersRef = useRef<Record<string, number>>({});
  const inlineMaterialDraftsRef = useRef<
    Record<string, Pick<TextMaterial, "title" | "body" | "companyName" | "memo">>
  >({});
  const deletingEmptyMaterialIdsRef = useRef<Set<string>>(new Set());
  const [materialSubcategories, setMaterialSubcategories] = useState<
    MaterialSubcategory[]
  >([]);
  const [materialSubcategoriesLoading, setMaterialSubcategoriesLoading] =
    useState(false);
  const [materialFolders, setMaterialFolders] = useState<MaterialFolder[]>([]);
  const [materialFoldersLoading, setMaterialFoldersLoading] = useState(false);
  const [newMaterialFolderName, setNewMaterialFolderName] = useState("");
  const [isTextMaterialFormOpen, setIsTextMaterialFormOpen] = useState(false);
  const [editingTextMaterialId, setEditingTextMaterialId] = useState<
    string | null
  >(null);
  const [textMaterialForm, setTextMaterialForm] = useState<TextMaterialForm>(
    createEmptyTextMaterialForm,
  );
  const [activeMaterialCategory, setActiveMaterialCategory] =
    useState<MaterialCategory | null>(null);
  const [activeMaterialSubcategory, setActiveMaterialSubcategory] =
    useState("全部");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [materialSearchKeyword, setMaterialSearchKeyword] = useState("");
  const [expandedTextMaterialId, setExpandedTextMaterialId] = useState<
    string | null
  >(null);
  const [personalMaterialFiles, setPersonalMaterialFiles] = useState<
    PersonalMaterialFile[]
  >([]);
  const [personalMaterialFilesLoading, setPersonalMaterialFilesLoading] =
    useState(false);
  const [personalMaterialCategories, setPersonalMaterialCategories] = useState<
    PersonalMaterialCategory[]
  >([]);
  const [personalMaterialCategoriesLoading, setPersonalMaterialCategoriesLoading] =
    useState(false);
  const [activePersonalMaterialsFolder, setActivePersonalMaterialsFolder] =
    useState(false);
  const [activePersonalFileKind, setActivePersonalFileKind] =
    useState("全部");
  const [newPersonalMaterialCategoryName, setNewPersonalMaterialCategoryName] =
    useState("");
  const [personalFileName, setPersonalFileName] = useState("");
  const [personalFileUrl, setPersonalFileUrl] = useState("");
  const [personalFileKind, setPersonalFileKind] =
    useState<PersonalMaterialKind>(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
  const [personalFileMemo, setPersonalFileMemo] = useState("");
  const [personalFileSearchKeyword, setPersonalFileSearchKeyword] =
    useState("");
  const [editingPersonalMaterialFileId, setEditingPersonalMaterialFileId] =
    useState<string | null>(null);
  const [isPersonalMaterialFormOpen, setIsPersonalMaterialFormOpen] = useState(false);
  const [isTextCategoryManageOpen, setIsTextCategoryManageOpen] = useState(false);
  const [isPersonalCategoryManageOpen, setIsPersonalCategoryManageOpen] = useState(false);

  const isKnownMaterialCategory = (value: string): value is MaterialCategory => {
    return materialCategoryOptions.some((category) => category.value === value);
  };

  const resetMaterialViewState = () => {
    setActiveMaterialCategory(null);
    setActivePersonalMaterialsFolder(false);
    setActiveMaterialSubcategory("全部");
    setActivePersonalFileKind("全部");
    setNewSubcategoryName("");
    setMaterialSearchKeyword("");
    setPersonalFileSearchKeyword("");
    setExpandedTextMaterialId(null);
    setIsTextMaterialFormOpen(false);
    setEditingTextMaterialId(null);
    setEditingPersonalMaterialFileId(null);
  };

  const applyRouteFromHash = (hashValue: string) => {
    const route = hashValue.replace(/^#/, "");
    const [page, detail] = route.split("/");

    setSelectedCalendarEvent(null);

    if (page === "calendar") {
      setActivePage("calendar");
      setIsFormOpen(false);
      setIsDetailFormOpen(false);
      return;
    }

    if (page === "backup") {
      setActivePage("backup");
      setIsFormOpen(false);
      setIsDetailFormOpen(false);
      resetMaterialViewState();
      return;
    }

    if (page === "materials") {
      setActivePage("materials");
      setIsFormOpen(false);
      setIsDetailFormOpen(false);

      if (detail === "personal") {
        setActivePersonalMaterialsFolder(true);
        setActiveMaterialCategory(null);
        setActivePersonalFileKind("全部");
        setActiveMaterialSubcategory("全部");
        setMaterialSearchKeyword("");
        setExpandedTextMaterialId(null);
        return;
      }

      if (detail && isKnownMaterialCategory(detail)) {
        setActivePersonalMaterialsFolder(false);
        setActiveMaterialCategory(detail);
        setActiveMaterialSubcategory("全部");
        setNewSubcategoryName("");
        setMaterialSearchKeyword("");
        setExpandedTextMaterialId(null);
        setIsTextMaterialFormOpen(false);
        setEditingTextMaterialId(null);
        setTextMaterialForm(createEmptyTextMaterialForm(detail));
        return;
      }

      resetMaterialViewState();
      return;
    }

    setActivePage("companies");
    setActivePersonalMaterialsFolder(false);
    setActiveMaterialCategory(null);
    setIsTextMaterialFormOpen(false);
    setIsPersonalMaterialFormOpen(false);
    setIsFormOpen(false);
    setIsDetailFormOpen(false);

    if (detail === "waiting" || detail === "finished" || detail === "todo") {
      setActiveCompanyGroupKey(detail);
    } else {
      setActiveCompanyGroupKey("todo");
    }
  };

  const navigateToRoute = (route: string) => {
    const nextHash = route.startsWith("#") ? route : `#${route}`;

    if (window.location.hash === nextHash) {
      applyRouteFromHash(nextHash);
      return;
    }

    window.location.hash = nextHash;
  };

  const handleExportBackup = async () => {
    if (!user) {
      alert("请先登录后再导出备份");
      return;
    }

    try {
      const companyMailsByCompanyId = await Promise.all(
        companies.map(async (company) => {
          const mailsRef = collection(
            db,
            "users",
            user.uid,
            "companies",
            company.id,
            "mails",
          );
          const mailsSnapshot = await getDocs(query(mailsRef, orderBy("createdAt", "desc")));
          const mails = mailsSnapshot.docs.map((document) => {
            const data = document.data();

            return {
              id: document.id,
              companyId: company.id,
              companyName: company.name,
              subject: data.subject ?? "",
              body: data.body ?? "",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });

          return [company.id, mails] as const;
        }),
      );

      const backup = {
        app: "JobFlow",
        version: 2,
        exportedAt: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email ?? "",
        },
        companies,
        companyMails: Object.fromEntries(companyMailsByCompanyId),
        textMaterials,
        materialSubcategories,
        personalMaterialFiles,
        personalMaterialCategories,
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `jobflow-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("导出备份失败，请稍后再试");
    }
  };

  const handleImportBackup = async (event: any) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!user) {
      alert("请先登录后再导入备份");
      return;
    }

    const confirmed = window.confirm(
      "导入会把备份里的公司、材料、个人材料和公司信箱写入当前账号。相同 ID 的内容会被覆盖，其他现有内容不会自动删除。确定导入吗？",
    );

    if (!confirmed) return;

    try {
      const backup = JSON.parse(await file.text());

      if (backup?.app !== "JobFlow") {
        alert("这不是 JobFlow 备份文件");
        return;
      }

      const companiesToImport = normalizeBackupArray(backup.companies);
      const textMaterialsToImport = normalizeBackupArray(backup.textMaterials);
      const materialSubcategoriesToImport = normalizeBackupArray(
        backup.materialSubcategories,
      );
      const personalMaterialFilesToImport = normalizeBackupArray(
        backup.personalMaterialFiles,
      );
      const personalMaterialCategoriesToImport = normalizeBackupArray(
        backup.personalMaterialCategories,
      );
      const companyMailsToImport =
        backup.companyMails && typeof backup.companyMails === "object"
          ? backup.companyMails
          : {};

      for (const company of companiesToImport) {
        const companyId = String(company.id ?? "").trim();
        if (!companyId) continue;

        const companyRef = doc(db, "users", user.uid, "companies", companyId);
        const companyData = { ...company };
        delete companyData.id;

        await setDoc(
          companyRef,
          removeUndefinedFields({
            ...companyData,
            name: companyData.name ?? "",
            position: companyData.position ?? "",
            priority: companyData.priority ?? "middle",
            status: companyData.status ?? "active",
            myPageUrl: companyData.myPageUrl ?? "",
            loginId: companyData.loginId ?? "",
            loginPassword: companyData.loginPassword ?? "",
            memo: companyData.memo ?? "",
            flowItems: Array.isArray(companyData.flowItems)
              ? companyData.flowItems
              : [],
            createdAt: restoreBackupTimestamp(companyData.createdAt),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      }

      for (const material of textMaterialsToImport) {
        const materialId = String(material.id ?? "").trim();
        if (!materialId) continue;

        const materialData = { ...material };
        delete materialData.id;
        await setDoc(
          doc(db, "users", user.uid, "textMaterials", materialId),
          removeUndefinedFields({
            ...materialData,
            title: materialData.title ?? "",
            category: normalizeMaterialCategory(materialData.category),
            subcategory: normalizeSubcategoryName(materialData.subcategory),
            body: materialData.body ?? "",
            companyName: materialData.companyName ?? "",
            memo: materialData.memo ?? "",
            createdAt: restoreBackupTimestamp(materialData.createdAt),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      }

      for (const subcategory of materialSubcategoriesToImport) {
        const subcategoryId = String(subcategory.id ?? "").trim();
        if (!subcategoryId) continue;

        const subcategoryData = { ...subcategory };
        delete subcategoryData.id;
        await setDoc(
          doc(db, "users", user.uid, "materialSubcategories", subcategoryId),
          removeUndefinedFields({
            ...subcategoryData,
            parentCategory: normalizeMaterialCategory(
              subcategoryData.parentCategory,
            ),
            name: normalizeSubcategoryName(subcategoryData.name),
            createdAt: restoreBackupTimestamp(subcategoryData.createdAt),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      }

      for (const fileItem of personalMaterialFilesToImport) {
        const fileId = String(fileItem.id ?? "").trim();
        if (!fileId) continue;

        const fileData = { ...fileItem };
        delete fileData.id;
        await setDoc(
          doc(db, "users", user.uid, "materialFiles", fileId),
          removeUndefinedFields({
            ...fileData,
            name: fileData.name ?? "",
            fileUrl: fileData.fileUrl ?? "",
            kind: normalizePersonalMaterialKind(fileData.kind),
            memo: fileData.memo ?? "",
            createdAt: restoreBackupTimestamp(fileData.createdAt),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      }

      for (const category of personalMaterialCategoriesToImport) {
        const categoryId = String(category.id ?? "").trim();
        if (!categoryId) continue;

        const categoryData = { ...category };
        delete categoryData.id;
        await setDoc(
          doc(db, "users", user.uid, "materialFileCategories", categoryId),
          removeUndefinedFields({
            ...categoryData,
            name: normalizePersonalMaterialKind(categoryData.name),
            createdAt: restoreBackupTimestamp(categoryData.createdAt),
            updatedAt: serverTimestamp(),
          }),
          { merge: true },
        );
      }

      for (const [companyId, mails] of Object.entries(companyMailsToImport)) {
        if (!Array.isArray(mails)) continue;

        for (const mail of mails as any[]) {
          const mailId = String(mail.id ?? "").trim();
          if (!mailId) continue;

          await setDoc(
            doc(
              db,
              "users",
              user.uid,
              "companies",
              companyId,
              "mails",
              mailId,
            ),
            removeUndefinedFields({
              subject: mail.subject ?? "",
              body: cleanCompanyMailText(mail.body ?? ""),
              createdAt: restoreBackupTimestamp(mail.createdAt),
              updatedAt: serverTimestamp(),
            }),
            { merge: true },
          );
        }
      }

      alert("导入完成");
    } catch (error) {
      console.error(error);
      alert("导入失败，请确认 JSON 文件格式是否正确");
    }
  };

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#companies");
    }

    const handleHashChange = () => {
      applyRouteFromHash(window.location.hash || "#companies");
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const hasOpenModal =
      isFormOpen ||
      isDetailFormOpen ||
      isTextMaterialFormOpen ||
      isPersonalMaterialFormOpen ||
      isTextCategoryManageOpen ||
      isPersonalCategoryManageOpen ||
      selectedCalendarEvent !== null ||
      mailboxCompanyId !== null ||
      isCompanyMailFormOpen;

    if (!hasOpenModal) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [
    isFormOpen,
    isDetailFormOpen,
    isTextMaterialFormOpen,
    isPersonalMaterialFormOpen,
    isTextCategoryManageOpen,
    isPersonalCategoryManageOpen,
    selectedCalendarEvent,
    mailboxCompanyId,
    isCompanyMailFormOpen,
  ]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setCompaniesLoading(false);
      return;
    }

    setCompaniesLoading(true);

    const companiesRef = collection(db, "users", user.uid, "companies");
    const companiesQuery = query(companiesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      companiesQuery,
      (snapshot) => {
        const loadedCompanies: Company[] = snapshot.docs.map((document) => {
          const data = document.data();
          const status = (data.status ?? "active") as CompanyStatus;
          const flowItems = normalizeCompanyFlowItems(
            normalizeLoadedFlowItems(data),
            status,
          );

          return {
            id: document.id,
            name: data.name ?? "",
            position: data.position ?? "",
            priority: data.priority ?? "middle",
            status,
            myPageUrl: data.myPageUrl ?? "",
            loginId: data.loginId ?? "",
            loginPassword: data.loginPassword ?? "",
            memo: data.memo ?? "",
            flowItems,
          };
        });

        setCompanies(loadedCompanies);
        setCompaniesLoading(false);
      },
      (error) => {
        console.error(error);
        setCompaniesLoading(false);
        alert("读取公司信息失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !mailboxCompanyId) {
      setCompanyMails([]);
      setCompanyMailsLoading(false);
      setSelectedCompanyMailId(null);
      return;
    }

    setCompanyMailsLoading(true);

    const mailsRef = collection(
      db,
      "users",
      user.uid,
      "companies",
      mailboxCompanyId,
      "mails",
    );
    const mailsQuery = query(mailsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      mailsQuery,
      (snapshot) => {
        const loadedMails: CompanyMail[] = snapshot.docs.map((document) => {
          const data = document.data();

          return {
            id: document.id,
            subject: data.subject ?? "",
            body: data.body ?? "",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        });

        setCompanyMails(loadedMails);
        setSelectedCompanyMailId((prev) => {
          if (prev && loadedMails.some((mail) => mail.id === prev)) return prev;
          return null;
        });
        setCompanyMailsLoading(false);
      },
      (error) => {
        console.error(error);
        setCompanyMailsLoading(false);
        alert("读取公司信箱失败");
      },
    );

    return () => unsubscribe();
  }, [user, mailboxCompanyId]);

  useEffect(() => {
    if (!user) {
      setTextMaterials([]);
      setTextMaterialsLoading(false);
      return;
    }

    setTextMaterialsLoading(true);

    const textMaterialsRef = collection(db, "users", user.uid, "textMaterials");
    const textMaterialsQuery = query(
      textMaterialsRef,
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      textMaterialsQuery,
      (snapshot) => {
        const loadedTextMaterials: TextMaterial[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              title: data.title ?? data.question ?? "",
              category: normalizeMaterialCategory(data.category),
              subcategory: normalizeSubcategoryName(data.subcategory),
              body: data.body ?? data.answer ?? "",
              companyName: data.companyName ?? "",
              memo: data.memo ?? "",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        const emptyTextMaterials = loadedTextMaterials.filter(isEmptyTextMaterialContent);
        const visibleTextMaterials = loadedTextMaterials.filter(
          (material) => !isEmptyTextMaterialContent(material),
        );

        emptyTextMaterials.forEach((material) => {
          if (deletingEmptyMaterialIdsRef.current.has(material.id)) return;
          deletingEmptyMaterialIdsRef.current.add(material.id);

          deleteDoc(doc(db, "users", user.uid, "textMaterials", material.id))
            .catch((error) => {
              console.error(error);
            })
            .finally(() => {
              deletingEmptyMaterialIdsRef.current.delete(material.id);
            });
        });

        setTextMaterials(visibleTextMaterials);
        setTextMaterialsLoading(false);
      },
      (error) => {
        console.error(error);
        setTextMaterialsLoading(false);
        alert("读取文本材料失败");
      },
    );

    return () => unsubscribe();
  }, [user]);


  useEffect(() => {
    if (!user) {
      setPersonalMaterialFiles([]);
      setPersonalMaterialFilesLoading(false);
      return;
    }

    setPersonalMaterialFilesLoading(true);

    const filesRef = collection(db, "users", user.uid, "materialFiles");
    const filesQuery = query(filesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const loadedFiles: PersonalMaterialFile[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              name: data.name ?? "",
              fileUrl: data.fileUrl ?? data.driveUrl ?? data.downloadUrl ?? "",
              kind: normalizePersonalMaterialKind(data.kind),
              memo: data.memo ?? "",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setPersonalMaterialFiles(loadedFiles);
        setPersonalMaterialFilesLoading(false);
      },
      (error) => {
        console.error(error);
        setPersonalMaterialFilesLoading(false);
        alert("读取个人材料文件失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPersonalMaterialCategories([]);
      setPersonalMaterialCategoriesLoading(false);
      return;
    }

    setPersonalMaterialCategoriesLoading(true);

    const categoriesRef = collection(
      db,
      "users",
      user.uid,
      "materialFileCategories",
    );
    const categoriesQuery = query(categoriesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const loadedCategories: PersonalMaterialCategory[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              name: normalizePersonalMaterialKind(data.name),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setPersonalMaterialCategories(loadedCategories);
        setPersonalMaterialCategoriesLoading(false);
      },
      (error) => {
        console.error(error);
        setPersonalMaterialCategoriesLoading(false);
        alert("读取个人材料类别失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMaterialSubcategories([]);
      setMaterialSubcategoriesLoading(false);
      return;
    }

    setMaterialSubcategoriesLoading(true);

    const subcategoriesRef = collection(
      db,
      "users",
      user.uid,
      "materialSubcategories",
    );
    const subcategoriesQuery = query(
      subcategoriesRef,
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      subcategoriesQuery,
      (snapshot) => {
        const loadedSubcategories: MaterialSubcategory[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              parentCategory: normalizeMaterialCategory(data.parentCategory),
              name: normalizeSubcategoryName(data.name),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setMaterialSubcategories(loadedSubcategories);
        setMaterialSubcategoriesLoading(false);
      },
      (error) => {
        console.error(error);
        setMaterialSubcategoriesLoading(false);
        alert("读取词条分类失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMaterialFolders([]);
      setMaterialFoldersLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let isCancelled = false;

    const setupMaterialFolders = async () => {
      setMaterialFoldersLoading(true);

      try {
        const settingsRef = doc(db, "users", user.uid, "settings", "materialFolders");
        const settingsSnapshot = await getDoc(settingsRef);

        if (!settingsSnapshot.exists()) {
          await Promise.all([
            ...materialCategoryOptions.map((category, index) =>
              setDoc(doc(db, "users", user.uid, "materialFolders", category.value), {
                value: category.value,
                label: category.label,
                description: category.description,
                icon: category.value,
                order: index,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }),
            ),
            setDoc(settingsRef, {
              seeded: true,
              updatedAt: serverTimestamp(),
            }),
          ]);
        }

        if (isCancelled) return;

        const foldersRef = collection(db, "users", user.uid, "materialFolders");
        const foldersQuery = query(foldersRef, orderBy("order", "asc"));

        unsubscribe = onSnapshot(
          foldersQuery,
          (snapshot) => {
            const loadedFolders: MaterialFolder[] = snapshot.docs.map((document) => {
              const data = document.data();
              const value = normalizeMaterialCategory(data.value ?? document.id);
              const defaultInfo = materialCategoryOptions.find((item) => item.value === value);

              return {
                id: document.id,
                value,
                label: String(data.label ?? defaultInfo?.label ?? value),
                description: String(data.description ?? defaultInfo?.description ?? ""),
                icon: data.icon ?? defaultInfo?.icon,
                order: typeof data.order === "number" ? data.order : 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
            });

            setMaterialFolders(loadedFolders);
            setMaterialFoldersLoading(false);
          },
          (error) => {
            console.error(error);
            setMaterialFoldersLoading(false);
            alert("读取材料库目录失败");
          },
        );
      } catch (error) {
        console.error(error);
        setMaterialFoldersLoading(false);
        alert("初始化材料库目录失败");
      }
    };

    setupMaterialFolders();

    return () => {
      isCancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const filteredCompanies = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    if (!keyword) return companies;

    return companies.filter((company) => {
      const flowText = company.flowItems
        .map(
          (item) =>
            `${item.title} ${item.deadline} ${item.start} ${item.end} ${item.location} ${item.url} ${item.memo}`,
        )
        .join(" ");

      const targetText = [
        company.name,
        company.position,
        company.myPageUrl,
        company.loginId,
        company.memo,
        flowText,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [companies, searchKeyword]);

  const personalMaterialCategoryOptions = useMemo(() => {
    const customCategories = personalMaterialCategories
      .map((item) => normalizePersonalMaterialKind(item.name))
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter((name) => name !== DEFAULT_PERSONAL_MATERIAL_CATEGORY);

    const inferredCategories = personalMaterialFiles
      .map((file) => normalizePersonalMaterialKind(file.kind))
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter(
        (name) =>
          name !== DEFAULT_PERSONAL_MATERIAL_CATEGORY &&
          !customCategories.includes(name),
      );

    if (
      personalFileKind !== DEFAULT_PERSONAL_MATERIAL_CATEGORY &&
      !customCategories.includes(personalFileKind) &&
      !inferredCategories.includes(personalFileKind)
    ) {
      inferredCategories.push(personalFileKind);
    }

    return [
      DEFAULT_PERSONAL_MATERIAL_CATEGORY,
      ...customCategories,
      ...inferredCategories,
    ];
  }, [personalMaterialCategories, personalMaterialFiles, personalFileKind]);

  const personalMaterialCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      [DEFAULT_PERSONAL_MATERIAL_CATEGORY]: 0,
    };

    personalMaterialCategoryOptions.forEach((name) => {
      counts[name] = 0;
    });

    personalMaterialFiles.forEach((file) => {
      const name = normalizePersonalMaterialKind(file.kind);
      counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
  }, [personalMaterialCategoryOptions, personalMaterialFiles]);

  const filteredPersonalMaterialFiles = useMemo(() => {
    const keyword = personalFileSearchKeyword.trim().toLowerCase();

    return personalMaterialFiles.filter((file) => {
      const fileKind = normalizePersonalMaterialKind(file.kind);

      if (activePersonalFileKind !== "全部" && fileKind !== activePersonalFileKind) {
        return false;
      }

      if (!keyword) return true;

      const targetText = [
        file.name,
        getPersonalMaterialKindLabel(file.kind),
        file.fileUrl,
        file.memo,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [
    personalMaterialFiles,
    personalFileSearchKeyword,
    activePersonalFileKind,
  ]);

  const allMaterialFolders = useMemo(() => {
    const folders = materialFolders.length > 0
      ? materialFolders
      : materialCategoryOptions.map((category, index) => ({
          id: category.value,
          value: category.value,
          label: category.label,
          description: category.description,
          icon: category.icon,
          order: index,
        }));

    const existingValues = new Set(folders.map((folder) => folder.value));
    const inferredFolders = textMaterials
      .map((material) => material.category)
      .filter((category, index, array) => array.indexOf(category) === index)
      .filter((category) => !existingValues.has(category))
      .map((category, index) => ({
        id: category,
        value: category,
        label: getMaterialCategoryLabel(category),
        description: "",
        order: folders.length + index,
      }));

    return [...folders, ...inferredFolders].sort((a, b) => a.order - b.order);
  }, [materialFolders, textMaterials]);

  const activeMaterialCategoryInfo = useMemo(() => {
    if (!activeMaterialCategory) return null;

    return (
      allMaterialFolders.find(
        (category) => category.value === activeMaterialCategory,
      ) ?? null
    );
  }, [activeMaterialCategory, allMaterialFolders]);

  const materialCategoryCounts = useMemo(() => {
    return allMaterialFolders.reduce(
      (acc, category) => {
        acc[category.value] = textMaterials.filter(
          (material) => material.category === category.value,
        ).length;
        return acc;
      },
      {} as Record<MaterialCategory, number>,
    );
  }, [allMaterialFolders, textMaterials]);

  const activeSubcategoryOptions = useMemo(() => {
    if (!activeMaterialCategory) return ["其他"];

    const customSubcategories = materialSubcategories
      .filter((item) => item.parentCategory === activeMaterialCategory)
      .map((item) => item.name)
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter((name) => name !== "其他");

    return ["其他", ...customSubcategories];
  }, [activeMaterialCategory, materialSubcategories]);

  const activeSubcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 其他: 0 };

    if (!activeMaterialCategory) return counts;

    activeSubcategoryOptions.forEach((name) => {
      counts[name] = 0;
    });

    textMaterials.forEach((material) => {
      if (material.category !== activeMaterialCategory) return;
      const name = normalizeSubcategoryName(material.subcategory);
      counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
  }, [activeMaterialCategory, activeSubcategoryOptions, textMaterials]);

  const getSubcategoryOptionsForCategory = (category: MaterialCategory) => {
    const customSubcategories = materialSubcategories
      .filter((item) => item.parentCategory === category)
      .map((item) => normalizeSubcategoryName(item.name))
      .filter((name) => name !== "其他");

    const namesFromMaterials = textMaterials
      .filter((material) => material.category === category)
      .map((material) => normalizeSubcategoryName(material.subcategory))
      .filter((name) => name !== "其他");

    return ["其他", ...customSubcategories, ...namesFromMaterials].filter(
      (name, index, array) => array.indexOf(name) === index,
    );
  };

  const getMaterialsForCategoryAndSubcategory = (
    category: MaterialCategory,
    subcategoryName: string,
  ) => {
    return textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === subcategoryName,
    );
  };

  const filteredTextMaterials = useMemo(() => {
    const keyword = materialSearchKeyword.trim().toLowerCase();

    return textMaterials.filter((material) => {
      if (activeMaterialCategory && material.category !== activeMaterialCategory) {
        return false;
      }

      if (
        activeMaterialSubcategory !== "全部" &&
        normalizeSubcategoryName(material.subcategory) !== activeMaterialSubcategory
      ) {
        return false;
      }

      if (!keyword) return true;

      const targetText = [
        material.title,
        getMaterialCategoryLabel(material.category),
        normalizeSubcategoryName(material.subcategory),
        material.body,
        material.companyName,
        material.memo,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [
    textMaterials,
    activeMaterialCategory,
    activeMaterialSubcategory,
    materialSearchKeyword,
  ]);

  const documentTextMaterials = useMemo(() => {
    if (!activeMaterialCategory) return [];

    const keyword = materialSearchKeyword.trim().toLowerCase();

    return textMaterials.filter((material) => {
      if (material.category !== activeMaterialCategory) return false;
      if (!keyword) return true;

      const targetText = [
        material.title,
        getMaterialCategoryLabel(material.category),
        normalizeSubcategoryName(material.subcategory),
        material.body,
        material.companyName,
        material.memo,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [textMaterials, activeMaterialCategory, materialSearchKeyword]);

  const documentSubcategoryNames = useMemo(() => {
    if (!activeMaterialCategory) return [];

    const namesFromMaterials = documentTextMaterials.map((material) =>
      normalizeSubcategoryName(material.subcategory),
    );

    return [...activeSubcategoryOptions, ...namesFromMaterials].filter(
      (name, index, array) => array.indexOf(name) === index,
    );
  }, [
    activeMaterialCategory,
    activeSubcategoryOptions,
    documentTextMaterials,
  ]);

  const documentMaterialsBySubcategory = useMemo(() => {
    return documentSubcategoryNames.reduce(
      (acc, name) => {
        acc[name] = documentTextMaterials.filter(
          (material) => normalizeSubcategoryName(material.subcategory) === name,
        );
        return acc;
      },
      {} as Record<string, TextMaterial[]>,
    );
  }, [documentSubcategoryNames, documentTextMaterials]);

  const calendarEvents = useMemo(() => {
    return companies
      .flatMap((company) =>
        company.flowItems.map((item) => {
          if (
            company.status === "waiting" ||
            company.status === "rejected" ||
            company.status === "declined" ||
            company.status === "passed"
          ) {
            return null;
          }

          if (item.status !== "current") {
            return null;
          }

          if (item.timeMode === "deadline") {
            if (!item.deadline) return null;

            return {
              id: `${company.id}-${item.id}`,
              title: `${formatTimeOnly(item.deadline)} DDL｜${company.name}｜${item.title}`,
              start: getDateOnlyValue(item.deadline),
              allDay: true,
              className: "calendar-event-deadline",
              extendedProps: {
                companyName: company.name,
                itemTitle: item.title,
                mode: "deadline",
                deadline: item.deadline,
                location: item.location,
                url: item.url,
                memo: item.memo,
              },
            };
          }

          if (item.timeMode === "schedule") {
            if (!item.start) return null;

            return {
              id: `${company.id}-${item.id}`,
              title: `${company.name}｜${item.title}`,
              start: item.start,
              end: item.end || undefined,
              className: "calendar-event-schedule",
              extendedProps: {
                companyName: company.name,
                itemTitle: item.title,
                mode: "schedule",
                location: item.location,
                url: item.url,
                memo: item.memo,
              },
            };
          }

          return null;
        }),
      )
      .filter(Boolean);
  }, [companies]);

  const currentActionItems = useMemo<CurrentActionItem[]>(() => {
    return companies
      .flatMap((company) =>
        company.flowItems.map((item) => {
          if (company.status !== "active") return null;
          if (item.status !== "current") return null;
          if (item.timeMode !== "deadline" && item.timeMode !== "schedule") {
            return null;
          }

          const targetDate = getActionItemTime(item);
          if (!targetDate) return null;

          return {
            id: `${company.id}-${item.id}`,
            companyName: company.name,
            itemTitle: item.title,
            mode: item.timeMode,
            targetTime: item.timeMode === "deadline" ? item.deadline : item.start,
            endTime: item.timeMode === "schedule" ? item.end : "",
            location: item.location,
            url: item.url,
            memo: item.memo,
            sortTime: targetDate.getTime(),
            groupLabel: getActionGroupLabel(targetDate.getTime()),
          };
        }),
      )
      .filter((item): item is CurrentActionItem => item !== null)
      .sort((a, b) => a.sortTime - b.sortTime);
  }, [companies]);

  const currentActionGroups = useMemo(() => {
    const groupOrder = ["已逾期", "今天", "3 天内", "7 天内", "之后"];

    return groupOrder
      .map((label) => ({
        label,
        items: currentActionItems.filter((item) => item.groupLabel === label),
      }))
      .filter((group) => group.items.length > 0);
  }, [currentActionItems]);

  const companyGroupTabs = useMemo(() => {
    return companyGroupDefinitions.map((group) => ({
      ...group,
      count: filteredCompanies.filter(
        (company) => getCompanyGroupKey(company.status) === group.key,
      ).length,
    }));
  }, [filteredCompanies]);

  const companyDisplayGroups = useMemo(() => {
    return companyGroupDefinitions
      .filter((group) => group.key === activeCompanyGroupKey)
      .map((group) => ({
        ...group,
        items: filteredCompanies.filter(
          (company) => getCompanyGroupKey(company.status) === group.key,
        ),
      }));
  }, [filteredCompanies, activeCompanyGroupKey]);

  const mailboxCompany = useMemo(() => {
    if (!mailboxCompanyId) return null;
    return companies.find((company) => company.id === mailboxCompanyId) ?? null;
  }, [companies, mailboxCompanyId]);

  const selectedCompanyMail = useMemo(() => {
    if (!selectedCompanyMailId) return null;
    return companyMails.find((mail) => mail.id === selectedCompanyMailId) ?? null;
  }, [companyMails, selectedCompanyMailId]);

  const handleAuth = async () => {
    setAuthError("");

    if (!email || !password) {
      setAuthError("请输入邮箱和密码");
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setAuthError("密码请设置为 6 位以上");
        return;
      }

      if (password !== passwordConfirm) {
        setAuthError("两次输入的密码不一致");
        return;
      }
    }

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      console.error(error);
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCompanies([]);
    setCompanyMails([]);
    setCompanyMailsLoading(false);
    setMailboxCompanyId(null);
    setSelectedCompanyMailId(null);
    setIsCompanyMailFormOpen(false);
    setCompanyMailForm(createEmptyCompanyMailForm());
    setIsFormOpen(false);
    setEditingCompanyId(null);
    setForm(createEmptyForm());
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setTextMaterials([]);
    setTextMaterialsLoading(false);
    setPersonalMaterialFiles([]);
    setPersonalMaterialFilesLoading(false);
    setPersonalMaterialCategories([]);
    setPersonalMaterialCategoriesLoading(false);
    setActivePersonalMaterialsFolder(false);
    setActivePersonalFileKind("全部");
    setNewPersonalMaterialCategoryName("");
    setPersonalFileName("");
    setPersonalFileUrl("");
    setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
    setPersonalFileMemo("");
    setPersonalFileSearchKeyword("");
    setEditingPersonalMaterialFileId(null);
    setIsPersonalMaterialFormOpen(false);
    setIsTextCategoryManageOpen(false);
    setIsPersonalCategoryManageOpen(false);
    setMaterialSubcategories([]);
    setMaterialSubcategoriesLoading(false);
    setActiveMaterialSubcategory("全部");
    setNewSubcategoryName("");
    setIsTextMaterialFormOpen(false);
    setEditingTextMaterialId(null);
    setTextMaterialForm(createEmptyTextMaterialForm());
    setActiveMaterialCategory(null);
    setMaterialSearchKeyword("");
    setActivePage("companies");
    setSelectedCalendarEvent(null);
    window.history.replaceState(null, "", "#companies");
  };

  const updateFormField = <K extends keyof CompanyForm>(
    field: K,
    value: CompanyForm[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateFlowTitle = (itemId: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      flowItems: prev.flowItems.map((item) =>
        item.id === itemId ? { ...item, title: value } : item,
      ),
    }));
  };

  const updateDetailItem = <K extends keyof FlowItem>(
    field: K,
    value: FlowItem[K],
  ) => {
    setDetailItem((prev) => {
      if (!prev) return prev;

      if (field === "timeMode") {
        const nextTimeMode = value as TimeMode;

        return {
          ...prev,
          timeMode: nextTimeMode,
          deadline: nextTimeMode === "deadline" ? prev.deadline : "",
          start: nextTimeMode === "schedule" ? prev.start : "",
          end: nextTimeMode === "schedule" ? prev.end : "",
        };
      }

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const addFlowItem = () => {
    setForm((prev) => ({
      ...prev,
      flowItems: [...prev.flowItems, createEmptyFlowItem()],
    }));
  };

  const deleteFlowItem = (itemId: number) => {
    setForm((prev) => {
      const nextItems = prev.flowItems.filter((item) => item.id !== itemId);

      if (nextItems.length === 0) {
        return {
          ...prev,
          flowItems: [],
        };
      }

      return {
        ...prev,
        flowItems: normalizeCompanyFlowItems(nextItems, "active"),
      };
    });
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingCompanyId(null);
  };

  const openAddForm = () => {
    resetForm();
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setIsFormOpen(true);
  };

  const openEditForm = (company: Company) => {
    setForm({
      name: company.name,
      position: company.position,
      priority: company.priority,
      myPageUrl: company.myPageUrl ?? "",
      loginId: company.loginId ?? "",
      loginPassword: company.loginPassword ?? "",
      memo: company.memo ?? "",
      flowItems: company.flowItems.map((item, index) => ({
        id: item.id || Date.now() + index,
        title: item.title,
        status: item.status,
        timeMode: item.timeMode,
        deadline: item.deadline,
        start: item.start,
        end: item.end,
        location: item.location,
        url: item.url,
        memo: item.memo,
      })),
    });

    setEditingCompanyId(company.id);
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setIsFormOpen(true);
  };

  const openCurrentDetailForm = (company: Company) => {
    const currentItem = getCurrentFlowItem(company.flowItems);

    if (!currentItem) {
      alert("当前没有流程节点");
      return;
    }

    setIsFormOpen(false);
    setEditingCompanyId(null);
    setDetailCompanyId(company.id);
    setDetailItem({ ...currentItem });
    setIsDetailFormOpen(true);
  };

  const closeDetailForm = () => {
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
  };

  const openCompanyMailbox = (company: Company) => {
    setIsFormOpen(false);
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setMailboxCompanyId(company.id);
    setSelectedCompanyMailId(null);
    setIsCompanyMailFormOpen(false);
    setCompanyMailForm(createEmptyCompanyMailForm());
  };

  const closeCompanyMailbox = () => {
    setMailboxCompanyId(null);
    setCompanyMails([]);
    setCompanyMailsLoading(false);
    setSelectedCompanyMailId(null);
    setIsCompanyMailFormOpen(false);
    setCompanyMailForm(createEmptyCompanyMailForm());
  };

  const openAddCompanyMailForm = () => {
    setCompanyMailForm(createEmptyCompanyMailForm());
    setIsCompanyMailFormOpen(true);
  };

  const closeCompanyMailForm = () => {
    setCompanyMailForm(createEmptyCompanyMailForm());
    setIsCompanyMailFormOpen(false);
  };

  const updateCompanyMailFormField = <K extends keyof CompanyMailForm>(
    field: K,
    value: CompanyMailForm[K],
  ) => {
    setCompanyMailForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveCompanyMail = async () => {
    if (!user || !mailboxCompanyId) return;

    const subject = companyMailForm.subject.trim();
    const body = cleanCompanyMailText(companyMailForm.body);

    if (!subject) {
      alert("请输入邮件标题");
      return;
    }

    if (!body) {
      alert("请输入邮件正文");
      return;
    }

    try {
      const mailRef = await addDoc(
        collection(db, "users", user.uid, "companies", mailboxCompanyId, "mails"),
        {
          subject,
          body,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      );

      setSelectedCompanyMailId(mailRef.id);
      closeCompanyMailForm();
    } catch (error) {
      console.error(error);
      alert("保存邮件失败");
    }
  };

  const removeCompanyMail = async (mail: CompanyMail) => {
    if (!user || !mailboxCompanyId) return;

    const ok = window.confirm(`确定要删除「${mail.subject}」吗？`);
    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "companies", mailboxCompanyId, "mails", mail.id),
      );
    } catch (error) {
      console.error(error);
      alert("删除邮件失败");
    }
  };

  const saveCompany = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    if (!form.name.trim()) {
      alert("请输入公司名");
      return;
    }

    const validFlowItems = form.flowItems
      .filter((item) => item.title.trim() !== "")
      .map((item, index) => ({
        id: item.id || Date.now() + index,
        title: item.title.trim(),
        status: item.status,
        timeMode: item.timeMode,
        deadline: item.deadline,
        start: item.start,
        end: item.end,
        location: item.location.trim(),
        url: item.url.trim(),
        memo: item.memo.trim(),
      }));

    if (validFlowItems.length === 0) {
      alert("请至少输入一个流程节点");
      return;
    }

    const normalizedFlowItems = normalizeCompanyFlowItems(
      validFlowItems,
      "active",
    );

    const companyData = {
      name: form.name.trim(),
      position: form.position.trim(),
      priority: form.priority,
      status: editingCompanyId ? undefined : "active",
      myPageUrl: form.myPageUrl.trim(),
      loginId: form.loginId.trim(),
      loginPassword: form.loginPassword,
      memo: form.memo.trim(),
      flowItems: normalizedFlowItems,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingCompanyId) {
        const companyRef = doc(
          db,
          "users",
          user.uid,
          "companies",
          editingCompanyId,
        );
        await updateDoc(companyRef, {
          name: companyData.name,
          position: companyData.position,
          priority: companyData.priority,
          myPageUrl: companyData.myPageUrl,
          loginId: companyData.loginId,
          loginPassword: companyData.loginPassword,
          memo: companyData.memo,
          flowItems: companyData.flowItems,
          updatedAt: companyData.updatedAt,
        });
      } else {
        await addDoc(collection(db, "users", user.uid, "companies"), {
          ...companyData,
          status: "active",
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      console.error(error);
      alert("保存公司信息失败");
    }
  };

  const saveCurrentDetail = async () => {
    if (!user || !detailCompanyId || !detailItem) return;

    const company = companies.find((item) => item.id === detailCompanyId);

    if (!company) {
      alert("找不到公司信息");
      return;
    }

    const nextFlowItems = company.flowItems.map((item) =>
      item.id === detailItem.id
        ? {
            ...item,
            timeMode: detailItem.timeMode,
            deadline:
              detailItem.timeMode === "deadline" ? detailItem.deadline : "",
            start: detailItem.timeMode === "schedule" ? detailItem.start : "",
            end: detailItem.timeMode === "schedule" ? detailItem.end : "",
            location: detailItem.location.trim(),
            url: detailItem.url.trim(),
            memo: detailItem.memo.trim(),
          }
        : item,
    );

    try {
      const companyRef = doc(
        db,
        "users",
        user.uid,
        "companies",
        detailCompanyId,
      );
      await updateDoc(companyRef, {
        flowItems: nextFlowItems,
        updatedAt: serverTimestamp(),
      });

      closeDetailForm();
    } catch (error) {
      console.error(error);
      alert("保存当前阶段详情失败");
    }
  };

  const removeCompany = async (company: Company) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除 ${company.name} 吗？`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "companies", company.id));
    } catch (error) {
      console.error(error);
      alert("删除公司信息失败");
    }
  };

  const completeCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentItem = getCurrentFlowItem(company.flowItems);

    if (!currentItem) return;

    const ok = window.confirm(
      `确定「${currentItem.title}」已经完成，并等待结果吗？`,
    );
    if (!ok) return;

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);

      await updateDoc(companyRef, {
        status: "waiting",
        flowItems: company.flowItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("更新为等待结果失败");
    }
  };

  const passCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentIndex = getCurrentFlowIndex(company.flowItems);
    const currentItem = company.flowItems[currentIndex];

    if (!currentItem) return;

    const nextItem = getNextFlowItem(company.flowItems);
    const ok = window.confirm(
      nextItem
        ? `确定「${currentItem.title}」结果通过，并进入「${nextItem.title}」吗？`
        : `确定「${currentItem.title}」结果通过，并结束全部流程吗？`,
    );

    if (!ok) return;

    const nextIndex = currentIndex + 1;

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);

      if (nextIndex >= company.flowItems.length) {
        await updateDoc(companyRef, {
          status: "passed",
          flowItems: company.flowItems.map((item) => ({
            ...item,
            status: "done" as FlowStatus,
          })),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      await updateDoc(companyRef, {
        status: "active",
        flowItems: applyCurrentIndex(company.flowItems, nextIndex),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("推进流程失败");
    }
  };

  const failCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentIndex = getCurrentFlowIndex(company.flowItems);
    const currentItem = company.flowItems[currentIndex];

    if (!currentItem) return;

    const ok = window.confirm(
      `确定「${currentItem.title}」失败，并将 ${company.name} 标记为落选吗？`,
    );
    if (!ok) return;

    const updatedFlowItems = company.flowItems.map((item, index) => {
      if (index < currentIndex)
        return { ...item, status: "done" as FlowStatus };
      if (index === currentIndex)
        return { ...item, status: "failed" as FlowStatus };
      return { ...item, status: "todo" as FlowStatus };
    });

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);
      await updateDoc(companyRef, {
        status: "rejected",
        flowItems: updatedFlowItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("标记落选失败");
    }
  };


  const declineCompany = async (company: Company) => {
    if (!user) return;

    const ok = window.confirm(
      `确定将 ${company.name} 标记为辞退吗？`,
    );
    if (!ok) return;

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);
      await updateDoc(companyRef, {
        status: "declined",
        flowItems: createDeclinedFlowItems(company.flowItems, company.status),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("标记辞退失败");
    }
  };

  const updateTextMaterialFormField = <K extends keyof TextMaterialForm>(
    field: K,
    value: TextMaterialForm[K],
  ) => {
    setTextMaterialForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetTextMaterialForm = (category = activeMaterialCategory) => {
    setTextMaterialForm(createEmptyTextMaterialForm(category ?? "self_analysis"));
    setEditingTextMaterialId(null);
  };

  const openMaterialCategory = (category: MaterialCategory) => {
    navigateToRoute(`materials/${category}`);
  };

  const closeMaterialCategory = () => {
    navigateToRoute("materials");
  };

  const createMaterialSubcategoryWithName = async (rawName: string) => {
    if (!user || !activeMaterialCategory) return;

    const name = normalizeSubcategoryName(rawName);

    if (name === "其他") {
      alert("“其他”是默认分类，不需要重复新建");
      return;
    }

    if (activeSubcategoryOptions.includes(name)) {
      alert("这个分类已经存在");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "materialSubcategories"), {
        parentCategory: activeMaterialCategory,
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSubcategoryName("");
      setActiveMaterialSubcategory(name);
    } catch (error) {
      console.error(error);
      alert("新建词条分类失败");
    }
  };


  const openTextCategoryManager = () => {
    setNewSubcategoryName("");
    setIsTextCategoryManageOpen(true);
  };

  const closeTextCategoryManager = () => {
    setNewSubcategoryName("");
    setIsTextCategoryManageOpen(false);
  };

  const renameMaterialSubcategory = async (oldName: string) => {
    if (!user || !activeMaterialCategory) return;

    const nextName = normalizeSubcategoryName(
      window.prompt("请输入新的词条分类名", oldName) ?? "",
    );

    if (!nextName || nextName === oldName) return;

    if (nextName === "其他") {
      alert("不能重命名为默认分类“其他”");
      return;
    }

    if (activeSubcategoryOptions.includes(nextName)) {
      alert("这个分类已经存在");
      return;
    }

    const subcategoriesToRename = materialSubcategories.filter(
      (subcategory) =>
        subcategory.parentCategory === activeMaterialCategory &&
        subcategory.name === oldName,
    );

    const materialsToMove = textMaterials.filter(
      (material) =>
        material.category === activeMaterialCategory &&
        normalizeSubcategoryName(material.subcategory) === oldName,
    );

    try {
      await Promise.all([
        ...subcategoriesToRename.map((subcategory) =>
          updateDoc(
            doc(db, "users", user.uid, "materialSubcategories", subcategory.id),
            { name: nextName, updatedAt: serverTimestamp() },
          ),
        ),
        ...materialsToMove.map((material) =>
          updateDoc(doc(db, "users", user.uid, "textMaterials", material.id), {
            subcategory: nextName,
            updatedAt: serverTimestamp(),
          }),
        ),
      ]);

      if (activeMaterialSubcategory === oldName) {
        setActiveMaterialSubcategory(nextName);
      }
      if (textMaterialForm.subcategory === oldName) {
        setTextMaterialForm((prev) => ({ ...prev, subcategory: nextName }));
      }
    } catch (error) {
      console.error(error);
      alert("重命名词条分类失败");
    }
  };

  const deleteMaterialSubcategory = async (name: string) => {
    if (!user || !activeMaterialCategory) return;

    if (name === "其他") {
      alert("默认分类“其他”不能删除");
      return;
    }

    const materialsInSubcategory = textMaterials.filter(
      (material) =>
        material.category === activeMaterialCategory &&
        normalizeSubcategoryName(material.subcategory) === name,
    );

    const ok = window.confirm(
      materialsInSubcategory.length > 0
        ? `确定删除分类「${name}」吗？其中 ${materialsInSubcategory.length} 条词条会移动到「其他」。`
        : `确定删除分类「${name}」吗？`,
    );

    if (!ok) return;

    try {
      await Promise.all(
        materialsInSubcategory.map((material) =>
          updateDoc(doc(db, "users", user.uid, "textMaterials", material.id), {
            subcategory: "其他",
            updatedAt: serverTimestamp(),
          }),
        ),
      );

      const subcategoriesToDelete = materialSubcategories.filter(
        (subcategory) =>
          subcategory.parentCategory === activeMaterialCategory &&
          subcategory.name === name,
      );

      await Promise.all(
        subcategoriesToDelete.map((subcategory) =>
          deleteDoc(
            doc(db, "users", user.uid, "materialSubcategories", subcategory.id),
          ),
        ),
      );

      if (activeMaterialSubcategory === name) {
        setActiveMaterialSubcategory("全部");
      }
    } catch (error) {
      console.error(error);
      alert("删除词条分类失败");
    }
  };

  const openAddTextMaterialForm = () => {
    if (!activeMaterialCategory) {
      alert("请先进入一个材料分类");
      return;
    }

    resetTextMaterialForm(activeMaterialCategory);
    setIsTextMaterialFormOpen(true);
  };

  const openEditTextMaterialForm = (material: TextMaterial) => {
    setTextMaterialForm({
      title: material.title,
      category: material.category,
      subcategory: normalizeSubcategoryName(material.subcategory),
      body: material.body,
      companyName: material.companyName,
      memo: material.memo,
    });
    setEditingTextMaterialId(material.id);
    setIsTextMaterialFormOpen(true);
  };

  const closeTextMaterialForm = () => {
    resetTextMaterialForm();
    setIsTextMaterialFormOpen(false);
  };

  const saveTextMaterial = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const title = textMaterialForm.title.trim();
    const subcategory = normalizeSubcategoryName(textMaterialForm.subcategory);
    const body = textMaterialForm.body.trim();

    if (!title) {
      alert("请输入标题");
      return;
    }

    if (!subcategory) {
      alert("请选择词条分类");
      return;
    }

    if (!body) {
      alert("请填写回答或正文内容");
      return;
    }

    const materialData = {
      title,
      category: textMaterialForm.category,
      subcategory,
      body,
      companyName: textMaterialForm.companyName.trim(),
      memo: textMaterialForm.memo.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingTextMaterialId) {
        const materialRef = doc(
          db,
          "users",
          user.uid,
          "textMaterials",
          editingTextMaterialId,
        );
        await updateDoc(materialRef, materialData);
      } else {
        await addDoc(collection(db, "users", user.uid, "textMaterials"), {
          ...materialData,
          createdAt: serverTimestamp(),
        });
      }

      closeTextMaterialForm();
    } catch (error) {
      console.error(error);
      alert("保存文本材料失败");
    }
  };

  const removeTextMaterial = async (material: TextMaterial) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除「${material.title}」吗？`);
    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "textMaterials", material.id),
      );
      setExpandedTextMaterialId((prev) =>
        prev === material.id ? null : prev,
      );
    } catch (error) {
      console.error(error);
      alert("删除文本材料失败");
    }
  };


  const scheduleInlineTextMaterialSave = <K extends keyof Pick<TextMaterial, "title" | "body" | "companyName" | "memo">>(
    material: TextMaterial,
    field: K,
    value: TextMaterial[K],
  ) => {
    if (!user) return;

    const currentDraft = inlineMaterialDraftsRef.current[material.id] ?? {
      title: material.title ?? "",
      body: material.body ?? "",
      companyName: material.companyName ?? "",
      memo: material.memo ?? "",
    };

    const nextDraft = {
      ...currentDraft,
      [field]: value,
    };

    inlineMaterialDraftsRef.current[material.id] = nextDraft;

    setTextMaterials((prev) =>
      prev.map((item) =>
        item.id === material.id ? { ...item, [field]: value } : item,
      ),
    );

    if (inlineSaveTimersRef.current[material.id]) {
      window.clearTimeout(inlineSaveTimersRef.current[material.id]);
    }

    setInlineSavingMaterialIds((prev) => ({ ...prev, [material.id]: true }));

    inlineSaveTimersRef.current[material.id] = window.setTimeout(async () => {
      const latestDraft = inlineMaterialDraftsRef.current[material.id] ?? nextDraft;
      const shouldAutoDelete = isEmptyTextMaterialContent(latestDraft);

      try {
        if (shouldAutoDelete) {
          await deleteDoc(doc(db, "users", user.uid, "textMaterials", material.id));
          delete inlineMaterialDraftsRef.current[material.id];
          delete inlineSaveTimersRef.current[material.id];
          setTextMaterials((prev) => prev.filter((item) => item.id !== material.id));
          setExpandedTextMaterialId((prev) => (prev === material.id ? null : prev));
        } else {
          await updateDoc(doc(db, "users", user.uid, "textMaterials", material.id), {
            title: latestDraft.title,
            body: latestDraft.body,
            companyName: latestDraft.companyName,
            memo: latestDraft.memo,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error(error);
        alert("自动保存失败，请检查网络后再试");
      } finally {
        setInlineSavingMaterialIds((prev) => ({ ...prev, [material.id]: false }));
      }
    }, 650);
  };

  const createInlineTextMaterial = async (
    category: MaterialCategory,
    subcategoryName: string,
  ) => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const subcategory = normalizeSubcategoryName(subcategoryName);

    try {
      const documentRef = await addDoc(collection(db, "users", user.uid, "textMaterials"), {
        title: "新词条",
        category,
        subcategory,
        body: "",
        companyName: "",
        memo: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      navigateToRoute("materials");

      window.setTimeout(() => {
        document
          .getElementById(`text-material-${documentRef.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (error) {
      console.error(error);
      alert("新建词条失败");
    }
  };

  const openPersonalMaterialsFolder = () => {
    navigateToRoute("materials/personal");
  };

  const closePersonalMaterialsFolder = () => {
    navigateToRoute("materials");
    setNewPersonalMaterialCategoryName("");
    resetPersonalMaterialForm();
    setIsPersonalMaterialFormOpen(false);
    setIsPersonalCategoryManageOpen(false);
  };

  const createPersonalMaterialCategory = async () => {
    if (!user) return;

    const name = normalizePersonalMaterialKind(newPersonalMaterialCategoryName);

    if (name === DEFAULT_PERSONAL_MATERIAL_CATEGORY) {
      alert("“其他”是默认类别，不需要重复新建");
      return;
    }

    if (personalMaterialCategoryOptions.includes(name)) {
      alert("这个类别已经存在");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "materialFileCategories"), {
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewPersonalMaterialCategoryName("");
      setActivePersonalFileKind(name);
      setPersonalFileKind(name);
    } catch (error) {
      console.error(error);
      alert("新建个人材料类别失败");
    }
  };

  const deletePersonalMaterialCategory = async (name: string) => {
    if (!user) return;

    if (name === DEFAULT_PERSONAL_MATERIAL_CATEGORY) {
      alert("默认类别“其他”不能删除");
      return;
    }

    const filesInCategory = personalMaterialFiles.filter(
      (file) => normalizePersonalMaterialKind(file.kind) === name,
    );

    const ok = window.confirm(
      filesInCategory.length > 0
        ? `确定删除类别「${name}」吗？其中 ${filesInCategory.length} 条个人材料会移动到「其他」。`
        : `确定删除类别「${name}」吗？`,
    );

    if (!ok) return;

    try {
      await Promise.all(
        filesInCategory.map((file) =>
          updateDoc(doc(db, "users", user.uid, "materialFiles", file.id), {
            kind: DEFAULT_PERSONAL_MATERIAL_CATEGORY,
            updatedAt: serverTimestamp(),
          }),
        ),
      );

      const categoriesToDelete = personalMaterialCategories.filter(
        (category) => normalizePersonalMaterialKind(category.name) === name,
      );

      await Promise.all(
        categoriesToDelete.map((category) =>
          deleteDoc(
            doc(db, "users", user.uid, "materialFileCategories", category.id),
          ),
        ),
      );

      if (activePersonalFileKind === name) {
        setActivePersonalFileKind("全部");
      }

      if (personalFileKind === name) {
        setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
      }
    } catch (error) {
      console.error(error);
      alert("删除个人材料类别失败");
    }
  };

  const openPersonalCategoryManager = () => {
    setNewPersonalMaterialCategoryName("");
    setIsPersonalCategoryManageOpen(true);
  };

  const closePersonalCategoryManager = () => {
    setNewPersonalMaterialCategoryName("");
    setIsPersonalCategoryManageOpen(false);
  };

  const renamePersonalMaterialCategory = async (oldName: string) => {
    if (!user) return;

    const nextName = normalizePersonalMaterialKind(
      window.prompt("请输入新的材料类别名", oldName) ?? "",
    );

    if (!nextName || nextName === oldName) return;

    if (nextName === DEFAULT_PERSONAL_MATERIAL_CATEGORY) {
      alert("不能重命名为默认类别“其他”");
      return;
    }

    if (personalMaterialCategoryOptions.includes(nextName)) {
      alert("这个类别已经存在");
      return;
    }

    const categoriesToRename = personalMaterialCategories.filter(
      (category) => normalizePersonalMaterialKind(category.name) === oldName,
    );

    const filesToMove = personalMaterialFiles.filter(
      (file) => normalizePersonalMaterialKind(file.kind) === oldName,
    );

    try {
      await Promise.all([
        ...categoriesToRename.map((category) =>
          updateDoc(
            doc(db, "users", user.uid, "materialFileCategories", category.id),
            { name: nextName, updatedAt: serverTimestamp() },
          ),
        ),
        ...filesToMove.map((file) =>
          updateDoc(doc(db, "users", user.uid, "materialFiles", file.id), {
            kind: nextName,
            updatedAt: serverTimestamp(),
          }),
        ),
      ]);

      if (activePersonalFileKind === oldName) {
        setActivePersonalFileKind(nextName);
      }
      if (personalFileKind === oldName) {
        setPersonalFileKind(nextName);
      }
    } catch (error) {
      console.error(error);
      alert("重命名个人材料类别失败");
    }
  };

  const resetPersonalMaterialForm = () => {
    setPersonalFileName("");
    setPersonalFileUrl("");
    setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
    setPersonalFileMemo("");
    setEditingPersonalMaterialFileId(null);
  };

  const openAddPersonalMaterialFile = () => {
    resetPersonalMaterialForm();
    if (activePersonalFileKind !== "全部") {
      setPersonalFileKind(activePersonalFileKind);
    }
    setIsPersonalMaterialFormOpen(true);
  };

  const openEditPersonalMaterialFile = (file: PersonalMaterialFile) => {
    setPersonalFileName(file.name);
    setPersonalFileUrl(file.fileUrl);
    setPersonalFileKind(normalizePersonalMaterialKind(file.kind));
    setPersonalFileMemo(file.memo);
    setEditingPersonalMaterialFileId(file.id);
    setIsPersonalMaterialFormOpen(true);
  };

  const closePersonalMaterialForm = () => {
    resetPersonalMaterialForm();
    setIsPersonalMaterialFormOpen(false);
  };

  const savePersonalMaterialFile = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const name = personalFileName.trim();
    const fileUrl = normalizeMaterialFileUrl(personalFileUrl);

    if (!name) {
      alert("请输入材料名称");
      return;
    }

    if (!fileUrl) {
      alert("请输入 Google Drive 或其他网盘链接");
      return;
    }

    const materialData = {
      name,
      fileUrl,
      kind: normalizePersonalMaterialKind(personalFileKind),
      memo: personalFileMemo.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPersonalMaterialFileId) {
        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "materialFiles",
            editingPersonalMaterialFileId,
          ),
          materialData,
        );
      } else {
        await addDoc(collection(db, "users", user.uid, "materialFiles"), {
          ...materialData,
          createdAt: serverTimestamp(),
        });
      }

      closePersonalMaterialForm();
    } catch (error) {
      console.error(error);
      alert("保存个人材料链接失败");
    }
  };

  const removePersonalMaterialFile = async (file: PersonalMaterialFile) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除个人材料「${file.name}」吗？`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "materialFiles", file.id));

      if (editingPersonalMaterialFileId === file.id) {
        closePersonalMaterialForm();
      }
    } catch (error) {
      console.error(error);
      alert("删除个人材料失败");
    }
  };

  const toggleTextMaterialDetail = (materialId: string) => {
    setExpandedTextMaterialId((prev) =>
      prev === materialId ? null : materialId,
    );
  };

  const scrollToTextMaterial = (materialId: string) => {
    setExpandedTextMaterialId(materialId);

    requestAnimationFrame(() => {
      document
        .getElementById(`text-material-${materialId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const buildTextMaterialsPrintHtml = (
    materials: TextMaterial[],
    title: string,
  ) => {
    const exportedAt = new Date().toLocaleString();
    const materialSections = materials
      .map((material, index) => {
        const companyLine = material.companyName
          ? `<div class="meta-line"><strong>关联公司：</strong>${escapePrintHtml(material.companyName)}</div>`
          : "";
        const memoBlock = material.memo
          ? `<div class="memo-block"><strong>备注：</strong><div>${escapePrintHtml(material.memo)}</div></div>`
          : "";
        const createdLine = formatFirestoreDate(material.createdAt)
          ? `<span>创建：${escapePrintHtml(formatFirestoreDate(material.createdAt))}</span>`
          : "";
        const updatedLine = formatFirestoreDate(material.updatedAt)
          ? `<span>更新：${escapePrintHtml(formatFirestoreDate(material.updatedAt))}</span>`
          : "";

        return `
          <article class="print-material-card">
            <div class="print-card-index">${index + 1}</div>
            <h2>${escapePrintHtml(material.title)}</h2>
            <div class="meta-line"><strong>大类：</strong>${escapePrintHtml(getMaterialCategoryLabel(material.category))}</div>
            <div class="meta-line"><strong>词条分类：</strong>${escapePrintHtml(normalizeSubcategoryName(material.subcategory))}</div>
            ${companyLine}
            <div class="body-block">${escapePrintHtml(material.body)}</div>
            ${memoBlock}
            <div class="date-row">${createdLine}${updatedLine}</div>
          </article>
        `;
      })
      .join("");

    return `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>${escapePrintHtml(title)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 36px;
              color: #111827;
              background: #ffffff;
              font-family: Arial, "Hiragino Sans", "Yu Gothic", "Microsoft YaHei", sans-serif;
              line-height: 1.65;
            }
            .print-page-title {
              margin: 0;
              font-size: 28px;
              letter-spacing: -0.03em;
            }
            .print-subtitle {
              margin: 8px 0 28px;
              color: #667085;
              font-size: 13px;
            }
            .print-material-card {
              position: relative;
              page-break-inside: avoid;
              border: 1px solid #e5e7eb;
              border-radius: 18px;
              padding: 22px 24px;
              margin: 0 0 18px;
            }
            .print-card-index {
              position: absolute;
              top: 18px;
              right: 18px;
              min-width: 30px;
              height: 30px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 999px;
              background: #f2f4f7;
              color: #667085;
              font-size: 12px;
              font-weight: 700;
            }
            h2 {
              margin: 0 40px 12px 0;
              font-size: 22px;
              line-height: 1.35;
            }
            .meta-line {
              margin: 4px 0;
              color: #475467;
              font-size: 13px;
            }
            .body-block {
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              white-space: pre-wrap;
              font-size: 15px;
            }
            .memo-block {
              margin-top: 16px;
              padding: 12px 14px;
              border-radius: 12px;
              background: #f8f9fb;
              color: #475467;
              font-size: 13px;
              white-space: pre-wrap;
            }
            .date-row {
              display: flex;
              justify-content: flex-end;
              gap: 12px;
              margin-top: 14px;
              color: #98a2b3;
              font-size: 11px;
            }
            @media print {
              body { padding: 22mm 18mm; }
              .print-material-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1 class="print-page-title">${escapePrintHtml(title)}</h1>
          <p class="print-subtitle">导出时间：${escapePrintHtml(exportedAt)} / 共 ${materials.length} 条</p>
          ${materialSections}
        </body>
      </html>
    `;
  };

  const openPrintPdfWindow = (_title: string, html: string) => {
    const printWindow = window.open("", "_blank", "width=960,height=720");

    if (!printWindow) {
      alert("浏览器阻止了弹出窗口。请允许弹出窗口后再试一次。");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const exportTextMaterialsToPdf = (materials: TextMaterial[], title: string) => {
    if (materials.length === 0) {
      alert("当前没有可以导出的词条");
      return;
    }

    openPrintPdfWindow(title, buildTextMaterialsPrintHtml(materials, title));
  };

  const exportCurrentTextMaterialsToPdf = () => {
    if (!activeMaterialCategoryInfo) return;

    const searchText = materialSearchKeyword.trim()
      ? ` / 搜索：${materialSearchKeyword.trim()}`
      : "";

    exportTextMaterialsToPdf(
      documentTextMaterials,
      `${activeMaterialCategoryInfo.label}${searchText}`,
    );
  };

  const exportSingleTextMaterialToPdf = (material: TextMaterial) => {
    exportTextMaterialsToPdf(
      [material],
      `${getMaterialCategoryLabel(material.category)} / ${material.title}`,
    );
  };

  const copyToClipboard = async (label: string, value: string) => {
    if (!value) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      alert(`${label}已复制`);
    } catch (error) {
      console.error(error);
      alert("复制失败，请手动复制");
    }
  };

  const openActionItemDetail = (item: CurrentActionItem) => {
    setSelectedCalendarEvent({
      companyName: item.companyName,
      itemTitle: item.itemTitle,
      mode: item.mode,
      startText: formatDateTime(item.targetTime),
      endText: item.endTime ? formatDateTime(item.endTime) : "",
      location: item.location,
      url: item.url,
      memo: item.memo,
    });
  };

  const materialSearchText = materialSearchKeyword.trim();

  const getFolderSubcategoryNames = (category: MaterialCategory) => {
    const customSubcategories = materialSubcategories
      .filter((item) => item.parentCategory === category)
      .map((item) => normalizeSubcategoryName(item.name))
      .filter((name) => name !== "其他");

    const namesFromMaterials = textMaterials
      .filter((material) => material.category === category)
      .map((material) => normalizeSubcategoryName(material.subcategory))
      .filter((name) => name !== "其他");

    return [...customSubcategories, ...namesFromMaterials].filter(
      (name, index, array) => array.indexOf(name) === index,
    );
  };

  const getFolderMaterials = (category: MaterialCategory) => {
    return textMaterials.filter((material) => material.category === category);
  };

  const getDirectFolderMaterials = (category: MaterialCategory) => {
    return textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === "其他",
    );
  };

  const getVisibleDirectFolderMaterials = (category: MaterialCategory) => {
    const materials = getDirectFolderMaterials(category);

    if (!materialSearchText) return materials;

    return materials.filter(materialMatchesSearch);
  };

  const materialMatchesSearch = (material: TextMaterial) => {
    const keyword = materialSearchText.toLowerCase();
    if (!keyword) return false;

    return [
      material.title,
      getMaterialCategoryLabel(material.category),
      normalizeSubcategoryName(material.subcategory),
      material.body,
      material.memo,
    ]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  };

  const countFolderMatches = (category: MaterialCategory) => {
    if (!materialSearchText) return 0;
    return getFolderMaterials(category).filter(materialMatchesSearch).length;
  };

  const countSubcategoryMatches = (category: MaterialCategory, subcategoryName: string) => {
    if (!materialSearchText) return 0;
    return textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === subcategoryName &&
        materialMatchesSearch(material),
    ).length;
  };

  const getVisibleMaterialsForSubcategory = (
    category: MaterialCategory,
    subcategoryName: string,
  ) => {
    const materials = textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === subcategoryName,
    );

    if (!materialSearchText) return materials;

    return materials.filter(materialMatchesSearch);
  };

  const getVisibleSubcategoryNames = (category: MaterialCategory) => {
    const subcategoryNames = getFolderSubcategoryNames(category);

    if (!materialSearchText) return subcategoryNames;

    return subcategoryNames.filter(
      (subcategoryName) =>
        getVisibleMaterialsForSubcategory(category, subcategoryName).length > 0,
    );
  };

  const totalMaterialSearchMatches = materialSearchText
    ? textMaterials.filter(materialMatchesSearch).length
    : textMaterials.length;


  const scheduleMaterialFolderSave = async (folder: MaterialFolder, label: string) => {
    if (!user) return;

    const nextLabel = label.trim();
    if (!nextLabel || nextLabel === folder.label) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "materialFolders", folder.id), {
        label: nextLabel,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("保存大目录名称失败");
    }
  };

  const handleWordFolderTitleBlur = (event: any, folder: MaterialFolder) => {
    const nextLabel = (event.currentTarget.textContent ?? "").trim();

    if (!nextLabel) {
      event.currentTarget.textContent = folder.label;
      return;
    }

    scheduleMaterialFolderSave(folder, nextLabel);
  };

  const handleWordSubcategoryTitleBlur = (
    event: any,
    category: MaterialCategory,
    subcategoryName: string,
  ) => {
    const nextName = (event.currentTarget.textContent ?? "").trim();

    if (!nextName) {
      event.currentTarget.textContent = subcategoryName;
      return;
    }

    renameWordSubcategory(category, subcategoryName, nextName);
  };

  const createMaterialFolder = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const label = newMaterialFolderName.trim();
    if (!label) return;

    const value = `custom_${Date.now()}`;

    try {
      await setDoc(doc(db, "users", user.uid, "materialFolders", value), {
        value,
        label,
        description: "",
        order: allMaterialFolders.length + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewMaterialFolderName("");
    } catch (error) {
      console.error(error);
      alert("新建大目录失败");
    }
  };

  const deleteMaterialFolder = async (folder: MaterialFolder) => {
    if (!user) return;

    const materialsInFolder = textMaterials.filter((material) => material.category === folder.value);
    const subcategoriesInFolder = materialSubcategories.filter(
      (subcategory) => subcategory.parentCategory === folder.value,
    );

    const ok = window.confirm(
      materialsInFolder.length > 0
        ? `确定删除大目录「${folder.label}」吗？其中 ${materialsInFolder.length} 条词条也会一起删除。`
        : `确定删除大目录「${folder.label}」吗？`,
    );

    if (!ok) return;

    try {
      await Promise.all([
        deleteDoc(doc(db, "users", user.uid, "materialFolders", folder.id)),
        ...materialsInFolder.map((material) =>
          deleteDoc(doc(db, "users", user.uid, "textMaterials", material.id)),
        ),
        ...subcategoriesInFolder.map((subcategory) =>
          deleteDoc(doc(db, "users", user.uid, "materialSubcategories", subcategory.id)),
        ),
      ]);
    } catch (error) {
      console.error(error);
      alert("删除大目录失败");
    }
  };

  const createWordSubcategory = async (category: MaterialCategory) => {
    if (!user) return;

    const name = window.prompt("请输入小目录名称", "新小目录");
    const nextName = normalizeSubcategoryName(name ?? "");
    if (!nextName) return;

    if (nextName === "其他") {
      alert("不需要新建“其他”。没有小目录的内容会直接显示在大目录下面。");
      return;
    }

    if (getFolderSubcategoryNames(category).includes(nextName)) {
      alert("这个小目录已经存在");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "materialSubcategories"), {
        parentCategory: category,
        name: nextName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("新建小目录失败");
    }
  };

  const renameWordSubcategory = async (
    category: MaterialCategory,
    oldName: string,
    nextRawName: string,
  ) => {
    if (!user) return;

    const nextName = normalizeSubcategoryName(nextRawName);
    if (!nextName || nextName === oldName) return;

    if (nextName === "其他") {
      alert("不能重命名为“其他”。没有小目录的内容会直接显示在大目录下面。");
      return;
    }

    const subcategoriesToRename = materialSubcategories.filter(
      (subcategory) =>
        subcategory.parentCategory === category &&
        normalizeSubcategoryName(subcategory.name) === oldName,
    );
    const materialsToMove = textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === oldName,
    );

    try {
      await Promise.all([
        ...(subcategoriesToRename.length > 0
          ? subcategoriesToRename.map((subcategory) =>
              updateDoc(doc(db, "users", user.uid, "materialSubcategories", subcategory.id), {
                name: nextName,
                updatedAt: serverTimestamp(),
              }),
            )
          : [
              addDoc(collection(db, "users", user.uid, "materialSubcategories"), {
                parentCategory: category,
                name: nextName,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }),
            ]),
        ...materialsToMove.map((material) =>
          updateDoc(doc(db, "users", user.uid, "textMaterials", material.id), {
            subcategory: nextName,
            updatedAt: serverTimestamp(),
          }),
        ),
      ]);
    } catch (error) {
      console.error(error);
      alert("重命名小目录失败");
    }
  };

  const deleteWordSubcategory = async (category: MaterialCategory, subcategoryName: string) => {
    if (!user) return;

    if (subcategoryName === "其他") {
      alert("默认小目录“其他”不能删除");
      return;
    }

    const materialsInSubcategory = textMaterials.filter(
      (material) =>
        material.category === category &&
        normalizeSubcategoryName(material.subcategory) === subcategoryName,
    );

    const ok = window.confirm(
      materialsInSubcategory.length > 0
        ? `确定删除小目录「${subcategoryName}」吗？其中 ${materialsInSubcategory.length} 条词条也会一起删除。`
        : `确定删除小目录「${subcategoryName}」吗？`,
    );

    if (!ok) return;

    const subcategoriesToDelete = materialSubcategories.filter(
      (subcategory) =>
        subcategory.parentCategory === category &&
        normalizeSubcategoryName(subcategory.name) === subcategoryName,
    );

    try {
      await Promise.all([
        ...subcategoriesToDelete.map((subcategory) =>
          deleteDoc(doc(db, "users", user.uid, "materialSubcategories", subcategory.id)),
        ),
        ...materialsInSubcategory.map((material) =>
          deleteDoc(doc(db, "users", user.uid, "textMaterials", material.id)),
        ),
      ]);
    } catch (error) {
      console.error(error);
      alert("删除小目录失败");
    }
  };

  const createWordMaterial = async (category: MaterialCategory, subcategoryName: string) => {
    await createInlineTextMaterial(category, subcategoryName);
  };


  void [
    newSubcategoryName,
    expandedTextMaterialId,
    personalMaterialFilesLoading,
    personalMaterialCategoriesLoading,
    personalMaterialCategoryCounts,
    filteredPersonalMaterialFiles,
    materialCategoryCounts,
    activeSubcategoryCounts,
    getSubcategoryOptionsForCategory,
    getMaterialsForCategoryAndSubcategory,
    filteredTextMaterials,
    documentMaterialsBySubcategory,
    updateTextMaterialFormField,
    openMaterialCategory,
    createMaterialSubcategoryWithName,
    openTextCategoryManager,
    closeTextCategoryManager,
    renameMaterialSubcategory,
    deleteMaterialSubcategory,
    openAddTextMaterialForm,
    openEditTextMaterialForm,
    saveTextMaterial,
    removeTextMaterial,
    openPersonalMaterialsFolder,
    createPersonalMaterialCategory,
    deletePersonalMaterialCategory,
    openPersonalCategoryManager,
    closePersonalCategoryManager,
    renamePersonalMaterialCategory,
    openAddPersonalMaterialFile,
    openEditPersonalMaterialFile,
    savePersonalMaterialFile,
    removePersonalMaterialFile,
    toggleTextMaterialDetail,
    exportCurrentTextMaterialsToPdf,
    exportSingleTextMaterialToPdf
  ];

  if (authLoading) {
    return <div className="auth-page">加载中...</div>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img className="app-logo-image" src={jobflowLogo} alt="JobFlow" />
          <p></p>
          

          <label>
            
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@gmail.com"
            />
          </label>

          <label>
            
            <div className="inline-input-button">
              <input
                type={showAuthPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
              />
              <button
                type="button"
                className="mini-button auth-password-toggle"
                onClick={() => setShowAuthPassword((current) => !current)}
              >
                {showAuthPassword ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          {isRegisterMode && (
            <label>
              
              <input
                type={showAuthPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="请再输入一次密码"
              />
            </label>
          )}

          {authError && <p className="error-text">{authError}</p>}

          <button className="primary-button auth-button" onClick={handleAuth}>
            {isRegisterMode ? "注册" : "登录"}
          </button>

          <button
            className="text-button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev);
              setAuthError("");
              setPassword("");
              setPasswordConfirm("");
            }}
          >
            {isRegisterMode ? "已有账号？点击登录" : "第一次使用？点击注册"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header app-header-row">
        <div>
          <img className="app-logo-image" src={jobflowLogo} alt="JobFlow" />
        
          <p className="login-user">当前登录：{user.email}</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="module-nav-shell">
        {activePage === "materials" &&
          (activeMaterialCategory || activePersonalMaterialsFolder) && (
            <button
              className="module-back-button"
              type="button"
              onClick={
                activePersonalMaterialsFolder
                  ? closePersonalMaterialsFolder
                  : closeMaterialCategory
              }
            >
              ← 返回
            </button>
          )}

        <section className="module-nav">
          <button
            className={`module-tab ${activePage === "companies" ? "active" : ""}`}
            onClick={() => navigateToRoute("companies")}
          >
            公司管理
          </button>

          <button
            className={`module-tab ${activePage === "calendar" ? "active" : ""}`}
            onClick={() => navigateToRoute("calendar")}
          >
            日历
          </button>

          <button
            className={`module-tab ${activePage === "materials" ? "active" : ""}`}
            onClick={() => navigateToRoute("materials")}
          >
            材料库
          </button>

          <button
            className={`module-tab ${activePage === "backup" ? "active" : ""}`}
            onClick={() => navigateToRoute("backup")}
          >
            数据管理
          </button>
        </section>
      </section>

      {activePage === "companies" && (
        <>
          <section className="toolbar toolbar-row">
            <button onClick={openAddForm}>＋添加公司</button>

            <input
              className="search-input"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="按公司名、职位、备注、流程节点等搜索"
            />
          </section>

          <section className="company-group-tabs" aria-label="公司状态分类">
            {companyGroupTabs.map((group) => (
              <button
                key={group.key}
                className={`company-group-tab company-group-tab-${group.key} ${
                  activeCompanyGroupKey === group.key ? "active" : ""
                }`}
                onClick={() => navigateToRoute(`companies/${group.key}`)}
              >
                <span>{group.label}</span>
                <strong>{group.count} 社</strong>
              </button>
            ))}
          </section>

          {isFormOpen && (
            <div
              className="app-modal-overlay"
              onClick={() => {
                resetForm();
                setIsFormOpen(false);
              }}
            >
              <section
                className="form-card app-modal-card"
                onClick={(event) => event.stopPropagation()}
              >
              <div className="form-header">
                <h2>{editingCompanyId ? "编辑公司" : "添加公司"}</h2>
                <button
                  className="secondary-button"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  关闭
                </button>
              </div>

              <div className="form-grid">
                <label>
                  公司名
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateFormField("name", event.target.value)
                    }
                    placeholder="例：株式会社〇〇"
                  />
                </label>

                <label>
                  应聘职位
                  <input
                    value={form.position}
                    onChange={(event) =>
                      updateFormField("position", event.target.value)
                    }
                    placeholder="例：综合职 / 技术职 / 设计师"
                  />
                </label>

                <label>
                  优先度
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      updateFormField(
                        "priority",
                        event.target.value as Priority,
                      )
                    }
                  >
                    <option value="high">高</option>
                    <option value="middle">中</option>
                    <option value="low">低</option>
                  </select>
                </label>

                <label>
                  My Page 网址
                  <input
                    value={form.myPageUrl}
                    onChange={(event) =>
                      updateFormField("myPageUrl", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>

                <label>
                  My Page 登录 ID / 邮箱
                  <input
                    value={form.loginId}
                    onChange={(event) =>
                      updateFormField("loginId", event.target.value)
                    }
                    placeholder="邮箱或登录 ID"
                  />
                </label>

                <label>
                  My Page 密码
                  <input
                    type="password"
                    value={form.loginPassword}
                    onChange={(event) =>
                      updateFormField("loginPassword", event.target.value)
                    }
                    placeholder="密码"
                  />
                </label>
              </div>

              <label className="memo-field">
                公司备注
                <textarea
                  value={form.memo}
                  onChange={(event) =>
                    updateFormField("memo", event.target.value)
                  }
                  placeholder="志望动机、企业特点、准备事项等"
                />
              </label>

              <div className="flow-editor">
                <div className="steps-editor-header">
                  <h3>选考流程线</h3>
                  <button className="secondary-button" onClick={addFlowItem}>
                    ＋添加节点
                  </button>
                </div>

                {form.flowItems.length === 0 && (
                  <p className="form-hint">
                    还没有流程节点。请点击“＋添加节点”，只需要先填写大概的流程标题。
                  </p>
                )}

                {form.flowItems.map((item, index) => (
                  <div className="flow-title-row" key={item.id}>
                    <span className="flow-title-index">{index + 1}</span>

                    <input
                      value={item.title}
                      onChange={(event) =>
                        updateFlowTitle(item.id, event.target.value)
                      }
                      placeholder="例：会社説明会 / ES提出 / 一面"
                    />

                    <button
                      className="danger-button"
                      onClick={() => deleteFlowItem(item.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}

                <p className="form-hint">
                  添加公司时只需要设置流程标题。时间、地点、URL、备注等细节，之后在公司卡片里点击“编辑当前阶段详情”补充。
                </p>
              </div>

              <div className="form-actions">
                <button className="primary-button" onClick={saveCompany}>
                  {editingCompanyId ? "更新" : "添加"}
                </button>
              </div>
              </section>
            </div>
          )}

          {isDetailFormOpen && detailItem && (
            <div className="app-modal-overlay" onClick={closeDetailForm}>
              <section
                className="form-card app-modal-card"
                onClick={(event) => event.stopPropagation()}
              >
              <div className="form-header">
                <h2>编辑当前阶段详情</h2>
                <button className="secondary-button" onClick={closeDetailForm}>
                  关闭
                </button>
              </div>

              <div className="current-detail-title">
                <strong>当前阶段：</strong>
                <span>{detailItem.title}</span>
              </div>

              <div className="event-editor-grid">
                <label>
                  时间形式
                  <select
                    value={detailItem.timeMode}
                    onChange={(event) =>
                      updateDetailItem(
                        "timeMode",
                        event.target.value as TimeMode,
                      )
                    }
                  >
                    <option value="none">不设置时间</option>
                    <option value="deadline">截止时间</option>
                    <option value="schedule">开始结束时间</option>
                  </select>
                </label>

                {detailItem.timeMode === "deadline" && (
                  <label>
                    截止时间
                    <input
                      type="datetime-local"
                      value={detailItem.deadline}
                      onChange={(event) =>
                        updateDetailItem("deadline", event.target.value)
                      }
                    />
                  </label>
                )}

                {detailItem.timeMode === "schedule" && (
                  <>
                    <label>
                      开始时间
                      <input
                        type="datetime-local"
                        value={detailItem.start}
                        onChange={(event) =>
                          updateDetailItem("start", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      结束时间，可选
                      <input
                        type="datetime-local"
                        value={detailItem.end}
                        onChange={(event) =>
                          updateDetailItem("end", event.target.value)
                        }
                      />
                    </label>
                  </>
                )}

                <label>
                  地点
                  <input
                    value={detailItem.location}
                    onChange={(event) =>
                      updateDetailItem("location", event.target.value)
                    }
                    placeholder="例：WEB / 東京本社 / Zoom"
                  />
                </label>

                <label>
                  URL / Zoom
                  <input
                    value={detailItem.url}
                    onChange={(event) =>
                      updateDetailItem("url", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>
              </div>

              <label className="memo-field">
                阶段备注
                <textarea
                  value={detailItem.memo}
                  onChange={(event) =>
                    updateDetailItem("memo", event.target.value)
                  }
                  placeholder="提交方式、携带材料、面试官信息、注意事项等"
                />
              </label>

              <div className="form-actions">
                <button className="primary-button" onClick={saveCurrentDetail}>
                  保存详情
                </button>
              </div>
              </section>
            </div>
          )}

          {mailboxCompany && (
            <div className="app-modal-overlay company-mailbox-overlay" onClick={closeCompanyMailbox}>
              <section
                className="company-mailbox-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="company-mailbox-window-header">
                  <h2>{mailboxCompany.name}</h2>
                  <button
                    className="company-mailbox-close-button"
                    onClick={closeCompanyMailbox}
                    aria-label="关闭公司信箱"
                  >
                    ×
                  </button>
                </div>

                <div className="company-mailbox-layout">
                  <aside className="company-mail-list-pane">
                    <div className="company-mail-list-title">
                      <div>
                        <span>收件箱</span>
                        <strong>{companyMails.length} 封</strong>
                      </div>
                      <div className="company-mail-list-actions">
                        <button className="primary-button" onClick={openAddCompanyMailForm}>
                          ＋新增邮件
                        </button>
                      </div>
                    </div>

                    {companyMailsLoading && (
                      <div className="company-mail-empty">读取邮件中...</div>
                    )}

                    {!companyMailsLoading && companyMails.length === 0 && (
                      <div className="company-mail-empty">
                        这个公司的信箱现在是空的。点击“新增邮件”开始保存。
                      </div>
                    )}

                    {!companyMailsLoading &&
                      companyMails.map((mail) => (
                        <button
                          key={mail.id}
                          className={`company-mail-list-item ${
                            selectedCompanyMailId === mail.id ? "active" : ""
                          }`}
                          onClick={() =>
                            setSelectedCompanyMailId((currentId) =>
                              currentId === mail.id ? null : mail.id,
                            )
                          }
                        >
                          <span className="company-mail-list-icon">✉</span>
                          <span className="company-mail-list-content">
                            <strong>{mail.subject}</strong>
                          </span>
                        </button>
                      ))}
                  </aside>

                  {selectedCompanyMail && (
                    <section className="company-mail-detail-pane">
                      <div className="company-mail-detail-header">
                        <h3>{selectedCompanyMail.subject}</h3>

                        <button
                          className="danger-button"
                          onClick={() => removeCompanyMail(selectedCompanyMail)}
                        >
                          删除邮件
                        </button>
                      </div>

                      <div className="company-mail-body-card">
                        {renderCompanyMailBody(selectedCompanyMail.body)}
                      </div>
                    </section>
                  )}
                </div>

                {isCompanyMailFormOpen && (
                  <div
                    className="company-mail-form-overlay"
                    onClick={closeCompanyMailForm}
                  >
                    <div
                      className="company-mail-form-dialog"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="form-header">
                        <h3>新增邮件</h3>
                        <button className="secondary-button" onClick={closeCompanyMailForm}>
                          取消
                        </button>
                      </div>

                      <label>
                        邮件标题
                        <input
                          value={companyMailForm.subject}
                          onChange={(event) =>
                            updateCompanyMailFormField("subject", event.target.value)
                          }
                          placeholder="例：【株式会社マーブル】エントリーありがとうございます"
                        />
                      </label>

                      <label className="memo-field">
                        邮件正文
                        <textarea
                          className="company-mail-body-textarea"
                          value={companyMailForm.body}
                          onChange={(event) =>
                            updateCompanyMailFormField("body", event.target.value)
                          }
                          placeholder="把邮件正文原文粘贴到这里"
                        />
                      </label>

                      <div className="form-actions">
                        <button className="primary-button" onClick={saveCompanyMail}>
                          保存邮件
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          <section className="company-list">
            {companiesLoading && <div className="empty-card">加载中...</div>}

            {!companiesLoading && companies.length === 0 && (
              <div className="empty-card">
                还没有公司信息。请先点击“＋添加公司”进行登记。
              </div>
            )}

            {!companiesLoading &&
              companies.length > 0 &&
              filteredCompanies.length === 0 && (
                <div className="empty-card">没有找到符合搜索条件的公司。</div>
              )}

            {!companiesLoading &&
              companyDisplayGroups.map((group) => (
                <section className={`company-group company-group-${group.key}`} key={group.key}>
                  <div className="company-group-header">
                    <div>
                      <h3>{group.label}</h3>
                      <p>{group.description}</p>
                    </div>
                    <span className="material-folder-count">{group.items.length} 社</span>
                  </div>

                  <div className="company-group-list">
                    {group.items.length === 0 && (
                      <div className="empty-card">这个分类下暂时没有公司。</div>
                    )}

                    {group.items.map((company) => {
                const currentItem = getCurrentFlowItem(company.flowItems);
                const nextItem = getNextFlowItem(company.flowItems);
                return (
                  <article className="company-card" key={company.id}>
                    <div className="company-header">
                      <div>
                        <h2>{company.name}</h2>
                        <p>{company.position || "未填写职位"}</p>
                        <div className="badge-row">
                          <span
                            className={`badge priority-${company.priority}`}
                          >
                            优先度：{getPriorityLabel(company.priority)}
                          </span>
                          {company.status !== "passed" &&
                            company.status !== "rejected" &&
                            company.status !== "declined" && (
                              <span className={`badge status-${company.status}`}>
                                {getStatusLabel(company.status)}
                              </span>
                            )}
                        </div>
                      </div>

                      <div className="card-side">
                        <div className="card-actions">
                          <button
                            className="mailbox-icon-button"
                            onClick={() => openCompanyMailbox(company)}
                            title="打开公司信箱"
                            aria-label={`${company.name} 的信箱`}
                          >
                            <span className="mailbox-envelope" aria-hidden="true" />
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => openEditForm(company)}
                          >
                            编辑公司
                          </button>
                          {company.status !== "passed" &&
                            company.status !== "rejected" &&
                            company.status !== "declined" && (
                              <button
                                className="decline-button top-decline-button"
                                onClick={() => declineCompany(company)}
                              >
                                辞退
                              </button>
                            )}
                          <button
                            className="danger-button"
                            onClick={() => removeCompany(company)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>

                    {company.flowItems.length > 0 ? (
                      <div className="flow">
                        {company.flowItems.map((item, index) => (
                          <div
                            className="step-wrap"
                            key={`${company.id}-${item.id}`}
                          >
                            <span className={`step ${item.status}`}>
                              {item.title}
                            </span>
                            {index < company.flowItems.length - 1 && (
                              <span className="arrow">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-card">还没有设置选考流程。</div>
                    )}

                    {company.status === "passed" && (
                      <div className="finished-result-card finished-result-success finished-result-success-only">
                        <div className="finished-result-content">
                          <span className="finished-result-label">成功 / 内定</span>
                        </div>
                      </div>
                    )}

                    {company.status === "rejected" && (
                      <div className="finished-result-card finished-result-rejected finished-result-success-only">
                        <div className="finished-result-content">
                          <span className="finished-result-label">落选</span>
                        </div>
                      </div>
                    )}

                    {company.status === "declined" && (
                      <div className="finished-result-card finished-result-declined finished-result-success-only">
                        <div className="finished-result-content">
                          <span className="finished-result-label">辞退</span>
                        </div>
                      </div>
                    )}

                    {currentItem &&
                      company.status !== "passed" &&
                      company.status !== "rejected" &&
                      company.status !== "declined" && (
                      <div
                        className={`current-flow-card ${
                          company.status === "waiting" ? "waiting-result-card" : ""
                        }`}
                      >
                        {company.status === "waiting" ? (
                          <>
                            <div className="waiting-result-label">
                              等待结果中
                            </div>

                            <div className="stage-status-row waiting-stage-row">
                              <span className="stage-pill waiting-pill">
                                {currentItem.title}
                              </span>
                            </div>

                            <p className="waiting-result-note">
                              正在等待「{currentItem.title}」的结果
                              {nextItem
                                ? `，通过后进入「${nextItem.title}」。`
                                : "，通过后流程结束。"}
                            </p>

                            <div className="task-result-actions waiting-result-actions">
                              <button
                                className="success-button"
                                onClick={() => passCurrentFlowItem(company)}
                              >
                                通过
                              </button>
                              <button
                                className="danger-button"
                                onClick={() => failCurrentFlowItem(company)}
                              >
                                失败
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="stage-status-row">
                              <span className="stage-label-inline">
                                {currentItem.status === "failed"
                                  ? "落选"
                                  : "当前阶段"}
                              </span>
                              <span
                                className={`stage-pill ${
                                  currentItem.status === "failed"
                                    ? "failed-pill"
                                    : "current-pill"
                                }`}
                              >
                                {currentItem.title}
                              </span>
                            </div>

                            {currentItem.timeMode === "deadline" &&
                              currentItem.deadline && (
                                <p>
                                  <strong>截止时间：</strong>
                                  {formatDateTime(currentItem.deadline)}
                                </p>
                              )}

                            {currentItem.timeMode === "schedule" &&
                              currentItem.start && (
                                <p>
                                  <strong>时间：</strong>
                                  {formatDateTime(currentItem.start)}
                                  {currentItem.end
                                    ? ` ～ ${formatDateTime(currentItem.end)}`
                                    : ""}
                                </p>
                              )}

                            {currentItem.location && (
                              <p>
                                <strong>地点：</strong>
                                {currentItem.location}
                              </p>
                            )}

                            {currentItem.url && (
                              <p>
                                <strong>URL：</strong>
                                <a
                                  href={currentItem.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {currentItem.url}
                                </a>
                              </p>
                            )}

                            {currentItem.memo && (
                              <p>
                                <strong>备注：</strong>
                                {currentItem.memo}
                              </p>
                            )}

                            {company.status === "active" &&
                              currentItem.status === "current" && (
                                <div className="task-result-actions">
                                  <button
                                    className="secondary-button"
                                    onClick={() =>
                                      openCurrentDetailForm(company)
                                    }
                                  >
                                    编辑当前阶段详情
                                  </button>
                                  <button
                                    className="success-button"
                                    onClick={() =>
                                      completeCurrentFlowItem(company)
                                    }
                                  >
                                    已完成
                                  </button>
                                  <button
                                    className="danger-button"
                                    onClick={() => failCurrentFlowItem(company)}
                                  >
                                    失败
                                  </button>
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="company-extra">
                      {company.myPageUrl && (
                        <p>
                          <strong>My Page：</strong>
                          <a
                            href={company.myPageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {company.myPageUrl}
                          </a>
                        </p>
                      )}

                      {company.loginId && (
                        <p className="credential-row">
                          <strong>登录 ID：</strong>
                          <span>{company.loginId}</span>
                          <button
                            className="mini-button copy-button"
                            onClick={() =>
                              copyToClipboard("登录 ID", company.loginId ?? "")
                            }
                          >
                            复制
                          </button>
                        </p>
                      )}

                      {company.loginPassword && (
                        <p className="credential-row">
                          <strong>密码：</strong>
                          <span>{company.loginPassword}</span>
                          <button
                            className="mini-button copy-button"
                            onClick={() =>
                              copyToClipboard("密码", company.loginPassword ?? "")
                            }
                          >
                            复制
                          </button>
                        </p>
                      )}

                      {company.memo && (
                        <p>
                          <strong>备注：</strong>
                          {company.memo}
                        </p>
                      )}
                    </div>
                  </article>
                );
                    })}
                  </div>
                </section>
              ))}
          </section>
        </>
      )}

      {activePage === "calendar" && (
        <section className="calendar-section">
          <div className="calendar-header">
      
          
          </div>

          <div className="calendar-card action-list-card">
            <div className="action-list-header">
              <div>
                <h3>待办事项</h3>
                
              </div>
              <span className="material-folder-count">
                {currentActionItems.length} 件
              </span>
            </div>

            {currentActionGroups.length === 0 ? (
              <div className="empty-card compact-empty-card">
                当前没有设置时间的待办事项。
              </div>
            ) : (
              <div className="action-group-list">
                {currentActionGroups.map((group) => (
                  <div className="action-group" key={group.label}>
                    <h4>{group.label}</h4>
                    <div className="action-item-list">
                      {group.items.map((item) => (
                        <article
                          className={
                            item.groupLabel === "已逾期"
                              ? "action-item overdue"
                              : "action-item"
                          }
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openActionItemDetail(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openActionItemDetail(item);
                            }
                          }}
                        >
                          <div>
                            <strong>{item.companyName}</strong>
                            <p>{item.itemTitle}</p>
                          </div>
                          <div className="action-item-meta">
                            <span
                              className={
                                item.mode === "deadline"
                                  ? "badge event-type-badge deadline-badge"
                                  : "badge event-type-badge schedule-badge"
                              }
                            >
                              {item.mode === "deadline" ? "DDL" : "日程"}
                            </span>
                            <span>{formatDateTime(item.targetTime)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>



      {selectedCalendarEvent && (
            <div
              className="calendar-detail-overlay"
              onClick={() => setSelectedCalendarEvent(null)}
            >
              <div
                className="calendar-detail-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="calendar-detail-header">
                  <div>
                    <span
                      className={
                        selectedCalendarEvent.mode === "deadline"
                          ? "badge event-type-badge deadline-badge"
                          : "badge event-type-badge schedule-badge"
                      }
                    >
                      {selectedCalendarEvent.mode === "deadline"
                        ? "截止时间"
                        : "开始结束时间"}
                    </span>
                    <h3>{selectedCalendarEvent.itemTitle}</h3>
                    <p>{selectedCalendarEvent.companyName}</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setSelectedCalendarEvent(null)}
                  >
                    关闭
                  </button>
                </div>

                <div className="calendar-detail-body">
                  {selectedCalendarEvent.mode === "deadline" ? (
                    <p>
                      <strong>截止时间：</strong>
                      {selectedCalendarEvent.startText}
                    </p>
                  ) : (
                    <>
                      <p>
                        <strong>开始时间：</strong>
                        {selectedCalendarEvent.startText}
                      </p>
                      <p>
                        <strong>结束时间：</strong>
                        {selectedCalendarEvent.endText || "未设置"}
                      </p>
                    </>
                  )}

                  {selectedCalendarEvent.location && (
                    <p>
                      <strong>地点：</strong>
                      {selectedCalendarEvent.location}
                    </p>
                  )}

                  {selectedCalendarEvent.url && (
                    <p>
                      <strong>URL：</strong>
                      <a
                        href={selectedCalendarEvent.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedCalendarEvent.url}
                      </a>
                    </p>
                  )}

                  {selectedCalendarEvent.memo && (
                    <p>
                      <strong>备注：</strong>
                      {selectedCalendarEvent.memo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="calendar-card">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locales={[zhCnLocale]}
              locale="zh-cn"
              initialView="dayGridMonth"
              height="auto"
              events={calendarEvents as any}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{
                today: "今天",
                month: "月",
                week: "周",
                day: "日",
              }}
              eventClick={(info) => {
                const props = info.event.extendedProps as {
                  companyName?: string;
                  itemTitle?: string;
                  mode?: "deadline" | "schedule";
                  deadline?: string;
                  location?: string;
                  url?: string;
                  memo?: string;
                };

                const mode = props.mode ?? "schedule";

                setSelectedCalendarEvent({
                  companyName: props.companyName ?? "",
                  itemTitle: props.itemTitle ?? "",
                  mode,
                  startText:
                    mode === "deadline"
                      ? formatDateTime(props.deadline ?? "")
                      : info.event.start?.toLocaleString() ?? "",
                  endText: info.event.end?.toLocaleString() ?? "",
                  location: props.location ?? "",
                  url: props.url ?? "",
                  memo: props.memo ?? "",
                });
              }}
            />
          </div>
        </section>
      )}

      {activePage === "backup" && (
    <section className="backup-page">
     

      <article className="backup-card">
        <div className="backup-card-main">
          <span className="backup-card-icon">💾</span>
          <div>
            <h3>导出本地备份</h3>
            
          </div>
        </div>

        <div className="backup-summary-grid">
          <span>公司：{companies.length} 条</span>
          <span>文本材料：{textMaterials.length} 条</span>
          <span>文本分类：{materialSubcategories.length} 条</span>
          <span>个人材料链接：{personalMaterialFiles.length} 条</span>
        </div>

        <div className="backup-actions">
          <button className="primary-button" type="button" onClick={handleExportBackup}>
            导出本地备份 JSON
          </button>

          <label className="secondary-button backup-import-button">
            导入本地备份 JSON
            <input
              className="backup-file-input"
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
            />
          </label>
        </div>
      </article>
    </section>
      )}

      {activePage === "materials" && (
        <section className="word-material-page">
          <aside className="word-material-sidebar">
            <div className="word-sidebar-header">
              <div>
                <strong>材料库目录</strong>
                <span>{textMaterials.length} 条词条</span>
              </div>
            </div>

            <div className="word-global-search">
              <input
                value={materialSearchKeyword}
                onChange={(event) => setMaterialSearchKeyword(event.target.value)}
                placeholder="全局搜索，命中的关键词会高亮"
              />
              {materialSearchKeyword.trim() && (
                <button
                  className="mini-button"
                  type="button"
                  onClick={() => setMaterialSearchKeyword("")}
                >
                  清除
                </button>
              )}
            </div>

            <div className="word-create-folder-row">
              <input
                value={newMaterialFolderName}
                onChange={(event) => setNewMaterialFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createMaterialFolder();
                }}
                placeholder="添加大目录"
              />
              <button className="mini-button" type="button" onClick={createMaterialFolder}>
                添加
              </button>
            </div>

            <nav className="word-toc">
              {allMaterialFolders.map((folder) => {
                const subcategoryNames = getFolderSubcategoryNames(folder.value);
                const folderMaterials = getFolderMaterials(folder.value);
                const directMaterials = getVisibleDirectFolderMaterials(folder.value);
                const folderMatchCount = countFolderMatches(folder.value);

                if (materialSearchText && folderMatchCount === 0) return null;

                return (
                  <details className="word-toc-folder" key={folder.value} open={materialSearchText ? true : undefined}>
                    <summary>
                      <button
                        className="word-toc-toggle-button"
                        type="button"
                        title="展开 / 收起"
                        onClick={(event) => {
                          event.preventDefault();
                          const details = event.currentTarget.closest("details");
                          if (details) details.open = !details.open;
                        }}
                      >
                        ▾
                      </button>
                      <button
                        className="word-toc-main-button"
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          document
                            .getElementById(`material-folder-${folder.value}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <span>{folder.label}</span>
                        <small>
                          {folderMatchCount > 0 ? `${folderMatchCount} 命中 / ` : ""}
                          {folderMaterials.length}
                        </small>
                      </button>
                      <button
                        className="word-toc-icon-button"
                        type="button"
                        title="直接在这个大目录下添加词条"
                        onClick={(event) => {
                          event.preventDefault();
                          createWordMaterial(folder.value, "其他");
                        }}
                      >
                        文
                      </button>
                      <button
                        className="word-toc-icon-button"
                        type="button"
                        title="添加小目录"
                        onClick={(event) => {
                          event.preventDefault();
                          createWordSubcategory(folder.value);
                        }}
                      >
                        ＋
                      </button>
                      <button
                        className="word-toc-icon-button danger"
                        type="button"
                        title="删除大目录"
                        onClick={(event) => {
                          event.preventDefault();
                          deleteMaterialFolder(folder);
                        }}
                      >
                        ×
                      </button>
                    </summary>

                    <div className="word-toc-subfolders">
                      {directMaterials.length > 0 && (
                        <div className="word-toc-blocks word-toc-direct-blocks">
                          {directMaterials.map((material) => (
                            <button
                              type="button"
                              key={material.id}
                              className={materialMatchesSearch(material) ? "matched" : ""}
                              onClick={() => scrollToTextMaterial(material.id)}
                            >
                              • {material.title || "无标题"}
                            </button>
                          ))}
                        </div>
                      )}

                      {subcategoryNames.map((subcategoryName) => {
                        const materialsInSubcategory = textMaterials.filter(
                          (material) =>
                            material.category === folder.value &&
                            normalizeSubcategoryName(material.subcategory) === subcategoryName,
                        );
                        const subcategoryMatchCount = countSubcategoryMatches(folder.value, subcategoryName);

                        if (materialSearchText && subcategoryMatchCount === 0) return null;

                        return (
                          <details
                            className="word-toc-subfolder"
                            key={`${folder.value}-${subcategoryName}`}
                            open={materialSearchText ? true : undefined}
                          >
                            <summary>
                              <button
                                className="word-toc-toggle-button"
                                type="button"
                                title="展开 / 收起"
                                onClick={(event) => {
                                  event.preventDefault();
                                  const details = event.currentTarget.closest("details");
                                  if (details) details.open = !details.open;
                                }}
                              >
                                ▾
                              </button>
                              <button
                                className="word-toc-sub-button"
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  document
                                    .getElementById(`material-subfolder-${folder.value}-${subcategoryName}`)
                                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                              >
                                <span>{subcategoryName}</span>
                                <small>
                                  {subcategoryMatchCount > 0 ? `${subcategoryMatchCount} 命中 / ` : ""}
                                  {materialsInSubcategory.length}
                                </small>
                              </button>
                              <button
                                className="word-toc-icon-button"
                                type="button"
                                title="添加词条"
                                onClick={(event) => {
                                  event.preventDefault();
                                  createWordMaterial(folder.value, subcategoryName);
                                }}
                              >
                                ＋
                              </button>
                              <button
                                className="word-toc-icon-button danger"
                                type="button"
                                title="删除小目录"
                                onClick={(event) => {
                                  event.preventDefault();
                                  deleteWordSubcategory(folder.value, subcategoryName);
                                }}
                              >
                                ×
                              </button>
                            </summary>

                            <div className="word-toc-blocks">
                              {(materialSearchText
                                ? materialsInSubcategory.filter(materialMatchesSearch)
                                : materialsInSubcategory
                              ).map((material) => (
                                <button
                                  type="button"
                                  key={material.id}
                                  className={materialMatchesSearch(material) ? "matched" : ""}
                                  onClick={() => scrollToTextMaterial(material.id)}
                                >
                                  • {material.title || "无标题"}
                                </button>
                              ))}

                              {materialsInSubcategory.length === 0 && (
                                <button
                                  type="button"
                                  className="word-toc-empty-create"
                                  onClick={() => createWordMaterial(folder.value, subcategoryName)}
                                >
                                  ＋添加词条
                                </button>
                              )}
                            </div>
                          </details>
                        );
                      })}

                      {!materialSearchText && folderMaterials.length === 0 && subcategoryNames.length === 0 && (
                        <button
                          type="button"
                          className="word-toc-empty-create"
                          onClick={() => createWordMaterial(folder.value, "其他")}
                        >
                          ＋添加词条
                        </button>
                      )}
                    </div>
                  </details>
                );
              })}
            </nav>
          </aside>

          <main className="word-document-shell">
            <div className="word-document-toolbar">
              <div>
                <h2>材料库</h2>
                <p></p>
              </div>
              <span>
                {materialFoldersLoading || materialSubcategoriesLoading || textMaterialsLoading
                  ? "同步中..."
                  : materialSearchKeyword.trim()
                    ? `正在高亮搜索：${materialSearchKeyword.trim()}`
                    : "已同步"}
              </span>
            </div>

            {allMaterialFolders.length === 0 && !materialFoldersLoading && (
              <div className="empty-card">还没有大目录。请在左侧添加一个大目录。</div>
            )}

            {materialSearchText && totalMaterialSearchMatches === 0 && (
              <div className="empty-card">没有找到匹配的词条。</div>
            )}

            <div className="word-document-pages">
              {allMaterialFolders.map((folder) => {
                const subcategoryNames = getVisibleSubcategoryNames(folder.value);

                if (materialSearchText && countFolderMatches(folder.value) === 0) return null;

                return (
                  <section
                    className="word-document-page"
                    id={`material-folder-${folder.value}`}
                    key={folder.value}
                  >
                    <div className="word-folder-heading">
                      <div
                        className="word-folder-title"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(event) => handleWordFolderTitleBlur(event, folder)}
                      >
                        {folder.label}
                      </div>
                      <div className="word-folder-actions">
                        <button
                          className="mini-button"
                          type="button"
                          onClick={() => createWordMaterial(folder.value, "其他")}
                        >
                          ＋添加词条
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => createWordSubcategory(folder.value)}
                        >
                          ＋添加小目录
                        </button>
                      </div>
                    </div>

                    {getVisibleDirectFolderMaterials(folder.value).length === 0 &&
                      !materialSearchText &&
                      subcategoryNames.length === 0 && (
                        <div
                          className="word-empty-line"
                          onClick={() => createWordMaterial(folder.value, "其他")}
                        >
                          点击这里在「{folder.label}」下面直接添加第一条内容
                        </div>
                      )}

                    {getVisibleDirectFolderMaterials(folder.value).length > 0 && (
                      <div className="word-folder-direct-section">
                        {getVisibleDirectFolderMaterials(folder.value).map((material) => (
                          <article
                            className={`word-material-block ${materialMatchesSearch(material) ? "matched" : ""}`}
                            id={`text-material-${material.id}`}
                            key={material.id}
                          >
                            <WordEditableText
                              className="word-block-title"
                              value={material.title}
                              placeholder="输入标题"
                              searchKeyword={materialSearchText}
                              onChange={(value) =>
                                scheduleInlineTextMaterialSave(material, "title", value)
                              }
                            />

                            <WordEditableText
                              className="word-block-body"
                              value={material.body}
                              placeholder="点击这里直接输入正文。内容会自动保存。"
                              searchKeyword={materialSearchText}
                              onChange={(value) =>
                                scheduleInlineTextMaterialSave(material, "body", value)
                              }
                            />

                            <WordEditableText
                              className="word-block-memo"
                              value={material.memo}
                              placeholder="备注，可空"
                              searchKeyword={materialSearchText}
                              onChange={(value) =>
                                scheduleInlineTextMaterialSave(material, "memo", value)
                              }
                            />

                            <div className="word-autosave-line">
                              {inlineSavingMaterialIds[material.id] ? "保存中..." : "已自动保存"}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    {subcategoryNames.map((subcategoryName) => {
                      const materialsInSubcategory = getVisibleMaterialsForSubcategory(
                        folder.value,
                        subcategoryName,
                      );

                      return (
                        <section
                          className="word-subfolder-section"
                          id={`material-subfolder-${folder.value}-${subcategoryName}`}
                          key={`${folder.value}-${subcategoryName}`}
                        >
                          <div className="word-subfolder-heading">
                            <div
                              className="word-subfolder-title"
                              contentEditable={subcategoryName !== "其他"}
                              suppressContentEditableWarning
                              onBlur={(event) =>
                                handleWordSubcategoryTitleBlur(
                                  event,
                                  folder.value,
                                  subcategoryName,
                                )
                              }
                            >
                              {subcategoryName}
                            </div>

                            <button
                              className="mini-button"
                              type="button"
                              onClick={() => createWordMaterial(folder.value, subcategoryName)}
                            >
                              ＋添加词条
                            </button>
                          </div>

                          {materialsInSubcategory.length === 0 && (
                            <div
                              className="word-empty-line"
                              onClick={() => createWordMaterial(folder.value, subcategoryName)}
                            >
                              点击这里添加第一条内容
                            </div>
                          )}

                          {materialsInSubcategory.map((material) => (
                            <article
                              className={`word-material-block ${materialMatchesSearch(material) ? "matched" : ""}`}
                              id={`text-material-${material.id}`}
                              key={material.id}
                            >
                              <WordEditableText
                                className="word-block-title"
                                value={material.title}
                                placeholder="输入标题"
                                searchKeyword={materialSearchText}
                                onChange={(value) =>
                                  scheduleInlineTextMaterialSave(material, "title", value)
                                }
                              />

                              <WordEditableText
                                className="word-block-body"
                                value={material.body}
                                placeholder="点击这里直接输入正文。内容会自动保存。"
                                searchKeyword={materialSearchText}
                                onChange={(value) =>
                                  scheduleInlineTextMaterialSave(material, "body", value)
                                }
                              />

                              <WordEditableText
                                className="word-block-memo"
                                value={material.memo}
                                placeholder="备注，可空"
                                searchKeyword={materialSearchText}
                                onChange={(value) =>
                                  scheduleInlineTextMaterialSave(material, "memo", value)
                                }
                              />

                              <div className="word-autosave-line">
                                {inlineSavingMaterialIds[material.id] ? "保存中..." : "已自动保存"}
                              </div>
                            </article>
                          ))}
                        </section>
                      );
                    })}
                  </section>
                );
              })}
            </div>
          </main>
        </section>
      )}

    </main>
  );
}

export default App;
