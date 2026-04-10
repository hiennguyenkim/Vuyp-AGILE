(function () {
  const STORAGE_KEYS = {
    events: "events",
    registrations: "registrations",
    history: "history",
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function parseEventCodeNumber(code) {
    const match = /^EV(\d+)$/i.exec(normalizeString(code));
    return match ? Number(match[1]) : 0;
  }

  function formatEventCode(codeNumber) {
    return `EV${String(codeNumber).padStart(3, "0")}`;
  }

  function normalizeEvents(rawEvents, registrations) {
    const source = Array.isArray(rawEvents) ? rawEvents : [];
    const existingCodes = source
      .map((event) => parseEventCodeNumber(event?.code))
      .filter(Boolean);
    let nextCodeNumber =
      existingCodes.length > 0 ? Math.max(...existingCodes) + 1 : 1;

    return source.map((event) => {
      const id = normalizeString(event?.id) || createId("event");
      const registeredFromRecords = registrations.filter(
        (registration) => normalizeString(registration?.eventId) === id,
      ).length;
      const max = Math.max(1, normalizeNumber(event?.max, 1));
      const codeNumber = parseEventCodeNumber(event?.code);
      const now = new Date().toISOString();

      return {
        id,
        code: codeNumber
          ? formatEventCode(codeNumber)
          : formatEventCode(nextCodeNumber++),
        name: normalizeString(event?.name),
        desc: normalizeString(event?.desc || event?.description),
        speaker: normalizeString(event?.speaker),
        start: normalizeString(event?.start),
        end: normalizeString(event?.end),
        location: normalizeString(event?.location),
        max,
        registered: Math.max(
          0,
          normalizeNumber(event?.registered, 0),
          registeredFromRecords,
        ),
        createdAt:
          normalizeString(event?.createdAt) ||
          normalizeString(event?.updatedAt) ||
          now,
        updatedAt:
          normalizeString(event?.updatedAt) ||
          normalizeString(event?.createdAt) ||
          now,
      };
    });
  }

  function normalizeRegistrations(rawRegistrations, events) {
    const source = Array.isArray(rawRegistrations) ? rawRegistrations : [];
    const eventMap = new Map(events.map((event) => [event.id, event]));

    return source
      .map((registration) => {
        const eventId = normalizeString(registration?.eventId);
        const matchedEvent = eventMap.get(eventId);
        const eventName =
          normalizeString(registration?.eventName) ||
          normalizeString(registration?.name) ||
          matchedEvent?.name ||
          "";

        if (!eventId && !eventName) {
          return null;
        }

        return {
          id: normalizeString(registration?.id) || createId("registration"),
          eventId,
          eventCode:
            normalizeString(registration?.eventCode) ||
            matchedEvent?.code ||
            "",
          eventName,
          start:
            normalizeString(registration?.start) || matchedEvent?.start || "",
          end: normalizeString(registration?.end) || matchedEvent?.end || "",
          location:
            normalizeString(registration?.location) ||
            matchedEvent?.location ||
            "",
          studentName: normalizeString(registration?.studentName),
          studentId: normalizeString(registration?.studentId),
          studentCourse: normalizeString(registration?.studentCourse),
          studentGender: normalizeString(registration?.studentGender),
          registeredAt:
            normalizeString(registration?.registeredAt) ||
            new Date().toISOString(),
          status: normalizeString(registration?.status) || "Đã đăng ký",
        };
      })
      .filter(Boolean);
  }

  function sortEvents(events) {
    return [...events].sort((firstEvent, secondEvent) => {
      const firstTime = Date.parse(firstEvent.start || "") || 0;
      const secondTime = Date.parse(secondEvent.start || "") || 0;

      if (firstTime !== secondTime) {
        return firstTime - secondTime;
      }

      return firstEvent.code.localeCompare(secondEvent.code);
    });
  }

  function sortRegistrations(registrations) {
    return [...registrations].sort((firstRegistration, secondRegistration) => {
      const firstTime = Date.parse(firstRegistration.registeredAt || "") || 0;
      const secondTime = Date.parse(secondRegistration.registeredAt || "") || 0;
      return secondTime - firstTime;
    });
  }

  function buildLegacyHistory(rawHistory) {
    const source = Array.isArray(rawHistory) ? rawHistory : [];

    return source
      .map((item, index) => {
        const eventName =
          normalizeString(item?.eventName) || normalizeString(item?.name);

        if (!eventName) {
          return null;
        }

        return {
          id: `legacy-${index}`,
          eventId: normalizeString(item?.eventId),
          eventCode: normalizeString(item?.eventCode),
          eventName,
          start: normalizeString(item?.start),
          end: normalizeString(item?.end),
          location: normalizeString(item?.location),
          studentName: normalizeString(item?.studentName) || "Dữ liệu cũ",
          studentId: normalizeString(item?.studentId),
          studentCourse: normalizeString(item?.studentCourse),
          studentGender: normalizeString(item?.studentGender),
          registeredAt: normalizeString(item?.registeredAt),
          status: "Đã đăng ký",
          isLegacy: true,
        };
      })
      .filter(Boolean);
  }

  function readState() {
    const rawEvents = readJson(STORAGE_KEYS.events, []);
    const rawRegistrations = readJson(STORAGE_KEYS.registrations, []);
    const firstPassEvents = normalizeEvents(rawEvents, rawRegistrations);
    const registrations = normalizeRegistrations(
      rawRegistrations,
      firstPassEvents,
    );
    const events = normalizeEvents(firstPassEvents, registrations);
    const legacyHistory = buildLegacyHistory(
      readJson(STORAGE_KEYS.history, []),
    );

    if (JSON.stringify(rawEvents) !== JSON.stringify(events)) {
      writeJson(STORAGE_KEYS.events, events);
    }

    if (JSON.stringify(rawRegistrations) !== JSON.stringify(registrations)) {
      writeJson(STORAGE_KEYS.registrations, registrations);
    }

    return {
      events,
      registrations,
      legacyHistory,
    };
  }

  function persistState(events, registrations) {
    writeJson(STORAGE_KEYS.events, events);
    writeJson(STORAGE_KEYS.registrations, registrations);
  }

  function createEvent(payload) {
    const state = readState();
    const now = new Date().toISOString();

    const event = {
      id: createId("event"),
      code: formatEventCode(
        state.events.reduce((maxCode, item) => {
          return Math.max(maxCode, parseEventCodeNumber(item.code));
        }, 0) + 1,
      ),
      name: normalizeString(payload?.name),
      desc: normalizeString(payload?.desc),
      speaker: normalizeString(payload?.speaker),
      start: normalizeString(payload?.start),
      end: normalizeString(payload?.end),
      location: normalizeString(payload?.location),
      max: Math.max(1, normalizeNumber(payload?.max, 1)),
      registered: 0,
      createdAt: now,
      updatedAt: now,
    };

    const events = sortEvents([...state.events, event]);
    persistState(events, state.registrations);

    return {
      event,
      events,
      registrations: state.registrations,
    };
  }

  function updateEvent(eventId, payload) {
    const state = readState();
    const eventIndex = state.events.findIndex((event) => event.id === eventId);

    if (eventIndex === -1) {
      throw new Error("Không tìm thấy sự kiện cần cập nhật.");
    }

    const currentEvent = state.events[eventIndex];
    const updatedEvent = {
      ...currentEvent,
      name: normalizeString(payload?.name),
      desc: normalizeString(payload?.desc),
      speaker: normalizeString(payload?.speaker),
      start: normalizeString(payload?.start),
      end: normalizeString(payload?.end),
      location: normalizeString(payload?.location),
      max: Math.max(1, normalizeNumber(payload?.max, 1)),
      updatedAt: new Date().toISOString(),
    };

    const events = [...state.events];
    events[eventIndex] = updatedEvent;
    const sortedEvents = sortEvents(events);
    persistState(sortedEvents, state.registrations);

    return {
      event: updatedEvent,
      events: sortedEvents,
      registrations: state.registrations,
    };
  }

  function deleteEvent(eventId) {
    const state = readState();
    const deletedEvent = state.events.find((event) => event.id === eventId);

    if (!deletedEvent) {
      throw new Error("Không tìm thấy sự kiện cần xóa.");
    }

    const events = state.events.filter((event) => event.id !== eventId);
    const registrations = state.registrations.filter(
      (registration) => registration.eventId !== eventId,
    );
    const legacyHistory = state.legacyHistory.filter((item) => {
      if (item.eventId) {
        return item.eventId !== eventId;
      }

      return !(
        item.eventName === deletedEvent.name &&
        item.start === deletedEvent.start &&
        item.location === deletedEvent.location
      );
    });

    persistState(events, registrations);
    writeJson(STORAGE_KEYS.history, legacyHistory);

    return {
      event: deletedEvent,
      events,
      registrations,
    };
  }

  function getEventStatus(event) {
    const now = Date.now();
    const endTime = Date.parse(event?.end || "");
    const startTime = Date.parse(event?.start || "");
    const isFull =
      normalizeNumber(event?.registered) >= normalizeNumber(event?.max);

    if (Number.isFinite(endTime) && endTime < now) {
      return {
        text: "Đã kết thúc",
        tone: "ended",
        canRegister: false,
      };
    }

    if (isFull) {
      return {
        text: "Đã đầy",
        tone: "full",
        canRegister: false,
      };
    }

    if (Number.isFinite(startTime) && startTime <= now) {
      return {
        text: "Đang diễn ra",
        tone: "live",
        canRegister: true,
      };
    }

    return {
      text: "Sự kiện sắp diễn ra",
      tone: "open",
      canRegister: true,
    };
  }

  function isUpcomingEvent(event) {
    const startTime = Date.parse(event?.start || "");

    if (!Number.isFinite(startTime)) {
      return false;
    }

    return startTime > Date.now();
  }

  function registerStudent(eventId, student) {
    const state = readState();
    const eventIndex = state.events.findIndex((event) => event.id === eventId);

    if (eventIndex === -1) {
      return {
        ok: false,
        message: "Sự kiện không còn tồn tại.",
      };
    }

    const event = state.events[eventIndex];
    const status = getEventStatus(event);

    if (!status.canRegister) {
      return {
        ok: false,
        message:
          status.tone === "full"
            ? "Sự kiện đã đủ số lượng đăng ký."
            : "Sự kiện đã kết thúc, không thể đăng ký.",
      };
    }

    const normalizedStudentId = normalizeString(
      student?.studentId,
    ).toLowerCase();
    const isDuplicate = state.registrations.some((registration) => {
      return (
        registration.eventId === eventId &&
        normalizeString(registration.studentId).toLowerCase() ===
          normalizedStudentId
      );
    });

    if (isDuplicate) {
      return {
        ok: false,
        message:
          "MSSV này đã đăng ký tham gia sự kiện. Vui lòng không đăng ký lại!",
      };
    }

    const registeredAt = new Date().toISOString();
    const registration = {
      id: createId("registration"),
      eventId: event.id,
      eventCode: event.code,
      eventName: event.name,
      start: event.start,
      end: event.end,
      location: event.location,
      studentName: normalizeString(student?.studentName),
      studentId: normalizeString(student?.studentId),
      studentCourse: normalizeString(student?.studentCourse),
      studentGender: normalizeString(student?.studentGender),
      registeredAt,
      status: "Đã đăng ký",
    };

    const registrations = sortRegistrations([
      registration,
      ...state.registrations,
    ]);
    const events = [...state.events];
    events[eventIndex] = {
      ...event,
      registered: normalizeNumber(event.registered, 0) + 1,
      updatedAt: registeredAt,
    };

    persistState(events, registrations);

    return {
      ok: true,
      event: events[eventIndex],
      registration,
      events,
      registrations,
    };
  }

  function getHistoryEntries() {
    const state = readState();
    const seen = new Set();

    return sortRegistrations(
      [...state.registrations, ...state.legacyHistory].filter((entry) => {
        const uniqueKey = [
          entry.eventId,
          entry.eventName,
          entry.start,
          entry.location,
          entry.studentId,
          entry.registeredAt,
        ].join("|");

        if (seen.has(uniqueKey)) {
          return false;
        }

        seen.add(uniqueKey);
        return true;
      }),
    );
  }

  function getEventById(eventId) {
    const state = readState();
    return (
      state.events.find(
        (event) => normalizeString(event.id) === normalizeString(eventId),
      ) || null
    );
  }

  function getUpcomingEvents() {
    const state = readState();
    return sortEvents(state.events.filter(isUpcomingEvent));
  }

  function formatDateTime(value) {
    if (!value) {
      return "Chưa cập nhật";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value.replace("T", " ");
    }

    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  function formatDateRange(start, end) {
    if (!start && !end) {
      return "Chưa cập nhật";
    }

    if (!end) {
      return formatDateTime(start);
    }

    return `${formatDateTime(start)} - ${formatDateTime(end)}`;
  }

  feedbacks = [
    {
      eventId: "EV01",
      rating: 5,
      comment: "Sự kiện rất hay",
      createdAt: "2026-04-08T09:00:00",
    },
    {
      eventId: "EV01",
      rating: 4,
      comment: "Diễn giả tốt",
      createdAt: "2026-04-09T10:00:00",
    },
  ];

  window.ClubStorage = {
    createEvent,
    deleteEvent,
    formatDateRange,
    formatDateTime,
    getEventById,
    getEventStatus,
    getUpcomingEvents,
    getHistoryEntries,
    isUpcomingEvent,
    normalizeString,
    readState,
    registerStudent,
    sortEvents,
    sortRegistrations,
    updateEvent,
  };
})();
