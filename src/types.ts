type Performer = {
    name: string
    image: string
    id: string
}
type Site = {
    name: string
    id: string
}
type Tag = {
    id: number
    tag: string
}
type Scene = {
    id: string
    title: string
    description: string
    site_id: number
    date: string
    url: string
    poster: string
    background: Background,
    created: string
    last_updated: string
    performers: Array<Performer>
    site: Site
    tags: Array<Tag>
}

type Background = {
    large: string
    medium: string
    small: string
}

export {Background, Scene, Performer, Site, Tag};
