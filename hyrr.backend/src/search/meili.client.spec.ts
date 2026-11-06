import { MeiliClient, MeiliError, meiliQuote } from "./meili.client"

const response = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }) as any

describe("MeiliClient", () => {
  it("sends the bearer key, JSON body and strips a trailing slash from the host", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(202, { taskUid: 7 }))
    const client = new MeiliClient("http://meili:7700/", "master", 2000, fetchImpl)
    const task = await client.addDocuments("jobs", [{ id: "j1" }])
    expect(task.taskUid).toBe(7)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe("http://meili:7700/indexes/jobs/documents?primaryKey=id")
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer master",
    })
    expect(JSON.parse(init.body)).toEqual([{ id: "j1" }])
    expect(init.signal).toBeDefined()
  })

  it("omits Authorization when no key is configured", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { status: "available" }))
    const client = new MeiliClient("http://meili:7700", undefined, 2000, fetchImpl)
    await expect(client.health()).resolves.toBe(true)
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({})
  })

  it("maps HTTP errors to MeiliError with status and code", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(404, { message: "Index `jobs` not found.", code: "index_not_found" })
      )
    const client = new MeiliClient("http://meili", "k", 2000, fetchImpl)
    const err = await client.search("jobs", { q: "x" }).catch((e) => e)
    expect(err).toBeInstanceOf(MeiliError)
    expect(err).toMatchObject({ status: 404, code: "index_not_found" })
    // documentCount treats a missing index as null
    await expect(client.documentCount("jobs")).resolves.toBeNull()
  })

  it("aborts after the timeout", async () => {
    const fetchImpl = jest.fn(
      (_url: string, init: any) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener("abort", () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
          )
        )
    )
    const client = new MeiliClient("http://meili", "k", 20, fetchImpl as any)
    await expect(client.health()).rejects.toThrow(/timed out after 20 ms/)
  })

  it("network failures become MeiliError", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    const client = new MeiliClient("http://meili", "k", 2000, fetchImpl)
    await expect(client.health()).rejects.toBeInstanceOf(MeiliError)
  })

  it("waitForTask polls until succeeded and throws on failure", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(200, { uid: 1, status: "enqueued" }))
      .mockResolvedValueOnce(response(200, { uid: 1, status: "processing" }))
      .mockResolvedValueOnce(response(200, { uid: 1, status: "succeeded" }))
      .mockResolvedValueOnce(
        response(200, { uid: 2, status: "failed", error: { message: "bad", code: "invalid" } })
      )
    const client = new MeiliClient("http://meili", "k", 2000, fetchImpl)
    await expect(client.waitForTask(1, 5000, 1)).resolves.toMatchObject({ status: "succeeded" })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[0][0]).toBe("http://meili/tasks/1")
    await expect(client.waitForTask(2, 5000, 1)).rejects.toMatchObject({ code: "invalid" })
  })

  it("quotes filter values safely", () => {
    expect(meiliQuote('a"b\\c')).toBe('"a\\"b\\\\c"')
  })
})
