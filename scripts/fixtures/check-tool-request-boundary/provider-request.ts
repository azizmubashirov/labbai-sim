function getProviderBaseUrl(params: { account: string }): string {
  return `https://${params.account}.provider.example.com`
}

export function providerStatementRequest(body: (params: { account: string }) => unknown) {
  return {
    url: (params: { account: string }) => `${getProviderBaseUrl(params)}/api/v2/statements`,
    method: 'POST',
    body,
  }
}
