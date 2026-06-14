import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api";
import ContactsSidebar from "./ContactsSidebar";
import ContactDetail from "./ContactDetail";

const PAGE_SIZE = 50;

const defaultFilters = {
  q: "",
  statusId: null,
  sectorId: null,
  trainingSetId: null,
  assignedTo: "",
  purchased: null,            // null | true | false
  purchasePotential: null,    // null | 'düşük' | 'orta' | 'yüksek'
  waitingForReply: null,      // null | true | false
  sortBy: "last_message_at",
  sortDir: "desc",
};

export default function ContactsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

  const [filters, setFilters] = useState(defaultFilters);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [statuses, setStatuses] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [trainingSets, setTrainingSets] = useState([]);

  const debounceRef = useRef(null);

  useEffect(() => {
    api.get("/statuses").then((r) => setStatuses(r.data));
    api.get("/sectors").then((r) => setSectors(r.data));
    api.get("/training-sets").then((r) => setTrainingSets(r.data));
  }, []);

  const buildParams = useCallback((f, off) => {
    const params = { limit: PAGE_SIZE, offset: off, sort_by: f.sortBy, sort_dir: f.sortDir };
    if (f.q) params.q = f.q;
    if (f.statusId) params.status_id = f.statusId;
    if (f.sectorId) params.sector_id = f.sectorId;
    if (f.trainingSetId) params.training_set_id = f.trainingSetId;
    if (f.assignedTo) params.assigned_to = f.assignedTo;
    if (f.purchased !== null) params.purchased = f.purchased;
    if (f.purchasePotential) params.purchase_potential = f.purchasePotential;
    if (f.waitingForReply !== null) params.waiting_for_reply = f.waitingForReply;
    return params;
  }, []);

  const fetchList = useCallback(async (f, off = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.get("/contacts/search", { params: buildParams(f, off) });
      setTotal(res.data.total);
      setItems((prev) => append ? [...prev, ...res.data.items] : res.data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildParams]);

  // Filters değişince debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchList(filters, 0, false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [filters, fetchList]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchList(filters, next, true);
  };

  const selectContact = (id) => {
    setSearchParams(id ? { id: String(id) } : {}, { replace: false });
  };

  const refresh = () => fetchList(filters, 0, false);

  const selected = items.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <ContactsSidebar
        filters={filters}
        setFilters={setFilters}
        items={items}
        total={total}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={items.length < total}
        loadMore={loadMore}
        selectedId={selectedId}
        onSelect={selectContact}
        statuses={statuses}
        sectors={sectors}
        trainingSets={trainingSets}
      />
      <ContactDetail
        key={selectedId || "empty"}
        contactStub={selected}
        contactId={selectedId}
        statuses={statuses}
        sectors={sectors}
        trainingSets={trainingSets}
        onChanged={refresh}
        onSelectContact={selectContact}
      />
    </div>
  );
}
