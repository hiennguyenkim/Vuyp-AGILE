const DEFAULT_PAGE_SIZE = 5;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function buildPaginationButton(action, label) {
  return `
    <button
      type="button"
      class="secondary-btn table-pagination-btn"
      data-pagination-action="${action}"
    >
      ${label}
    </button>
  `;
}

export function paginateItems(items, currentPage = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const safePageSize = normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE);
  const totalItems = normalizedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safeCurrentPage = Math.min(
    totalPages,
    normalizePositiveInteger(currentPage, 1),
  );
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize;
  const endIndex = Math.min(totalItems, startIndex + safePageSize);

  return {
    items: normalizedItems.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    currentPage: safeCurrentPage,
    pageSize: safePageSize,
    startIndex,
    endIndex,
  };
}

export function getNextPageFromAction(action, currentPage, totalPages) {
  const safeCurrentPage = normalizePositiveInteger(currentPage, 1);
  const safeTotalPages = Math.max(1, normalizePositiveInteger(totalPages, 1));

  if (action === "first") {
    return 1;
  }

  if (action === "prev") {
    return Math.max(1, safeCurrentPage - 1);
  }

  if (action === "next") {
    return Math.min(safeTotalPages, safeCurrentPage + 1);
  }

  if (action === "last") {
    return safeTotalPages;
  }

  return safeCurrentPage;
}

export function renderPaginationControls(container, pagination, options = {}) {
  if (!container) {
    return;
  }

  const itemLabel =
    typeof options.itemLabel === "string" && options.itemLabel.trim()
      ? options.itemLabel.trim()
      : "mục";
  const hideWhenSinglePage = options.hideWhenSinglePage !== false;
  const totalItems = Number(pagination?.totalItems) || 0;
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1);
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Number(pagination?.currentPage) || 1),
  );
  const startIndex = Math.max(0, Number(pagination?.startIndex) || 0);
  const endIndex = Math.max(0, Number(pagination?.endIndex) || 0);

  container.dataset.totalPages = String(totalPages);
  container.dataset.currentPage = String(currentPage);

  if (totalItems === 0 || (hideWhenSinglePage && totalPages <= 1)) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const buttons = [];

  if (currentPage > 2) {
    buttons.push(buildPaginationButton("first", "Trang đầu"));
  }

  if (currentPage > 1) {
    buttons.push(buildPaginationButton("prev", "Trang trước"));
  }

  if (currentPage < totalPages) {
    buttons.push(buildPaginationButton("next", "Trang sau"));
  }

  if (currentPage < totalPages - 1) {
    buttons.push(buildPaginationButton("last", "Trang cuối"));
  }

  const displayFrom = totalItems === 0 ? 0 : startIndex + 1;

  container.hidden = false;
  container.innerHTML = `
    <div class="table-pagination-status">
      Hiển thị ${displayFrom}-${endIndex} trên ${totalItems} ${itemLabel} · Trang ${currentPage}/${totalPages}
    </div>
    <div class="table-pagination-actions">
      ${buttons.join("")}
    </div>
  `;
}
