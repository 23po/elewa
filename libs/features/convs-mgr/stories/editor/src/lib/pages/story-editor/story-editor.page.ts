import { ChangeDetectorRef, Component, OnInit, OnDestroy, ComponentRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ComponentPortal, TemplatePortal } from '@angular/cdk/portal';
import { FormControl, FormGroup } from '@angular/forms';

import { SubSink } from 'subsink';
import { BehaviorSubject, filter, map, Observable, of, switchMap } from 'rxjs';

import { BrowserJsPlumbInstance, newInstance } from '@jsplumb/browser-ui';

import { Breadcrumb, Logger } from '@iote/bricks-angular';

import { StoryEditorState, StoryEditorStateService } from '@app/state/convs-mgr/story-editor';

import { HOME_CRUMB, STORY_EDITOR_CRUMB } from '@app/elements/nav/convl/breadcrumbs';

import { BlockPortalService } from '../../providers/block-portal.service';
import { StoryEditorFrame } from '../../model/story-editor-frame.model';
import { AddBotToChannelModal } from '../../modals/add-bot-to-channel-modal/add-bot-to-channel.modal';

import { getActiveBlock } from '../../providers/fetch-active-block-component.function';
import { ManageChannelStoryLinkService } from '../../providers/manage-channel-story-link.service';
import { CommunicationChannel } from '/home/calvin/moringathings/development/code/phase6/elewa/libs/model/convs-mgr/conversations/admin/system/src/index';
import { ActiveStoryStore } from '@app/state/convs-mgr/stories';


@Component({
  selector: 'convl-story-editor-page',
  templateUrl: './story-editor.page.html',
  styleUrls: ['./story-editor.page.scss']
})
export class StoryEditorPageComponent implements OnInit, OnDestroy {
  private _sbs = new SubSink();
  portal$: Observable<TemplatePortal>;
  activeComponent: ComponentPortal<any>
  activeBlockForm: FormGroup
  activeBlockTitle: string
  
  opened: boolean;

  pageName: string;

  currentChannel: CommunicationChannel;

  state: StoryEditorState;
  breadcrumbs: Breadcrumb[] = [];

  loading = new BehaviorSubject<boolean>(true);
  frame: StoryEditorFrame;

  stateSaved: boolean = true;

  isPublished: boolean

  //TODO @CHESA LInk boolean to existence of story in DB
  storyHasBeenSaved: boolean = false;

  zoomLevel: FormControl = new FormControl(100);
  frameElement: HTMLElement;
  frameZoom = 1;
  frameZoomInstance: BrowserJsPlumbInstance;

  activeStoryName: string 
  activeStory: any;
 

  constructor(private _editorStateService: StoryEditorStateService,
              private _activeStoryStore$$: ActiveStoryStore,
              private _manageStoryLinkService: ManageChannelStoryLinkService,
              private _dialog: MatDialog,
              private _cd: ChangeDetectorRef,
              private _logger: Logger,
              private _blockPortalService: BlockPortalService,
              _router: Router
  ) {
    this._editorStateService.get()
      .subscribe((state: StoryEditorState) => {
        this._logger.log(() => `Loaded editor for story ${state.story.id}. Logging state.`)
        this._logger.log(() => state);

        this.state = state;
        this.pageName = `Story overview :: ${state.story.name}`;

        const story = state.story;
        this.breadcrumbs = [HOME_CRUMB(_router), STORY_EDITOR_CRUMB(_router, story.id, story.name, true)];
        this.loading.next(false);
        console.log(this.currentChannel)
      }
      );

       
}


  ngOnInit() {
    this._sbs.sink = this._blockPortalService.portal$.subscribe((blockDetails) => {
      if (blockDetails.form) {
        const comp = getActiveBlock(blockDetails.form.value.type);
        this.activeBlockForm = blockDetails.form
        this.activeBlockTitle = blockDetails.title
        this.activeComponent = new ComponentPortal(comp);
        this.opened = true;
        console.log(this.currentChannel)
        
      }
    });

    this._sbs.sink = this._activeStoryStore$$.get().subscribe(data => {
      this.activeStoryName = data.name;
      console.log(this.activeStoryName);
    
      // subscribe to the getChannelByName observable here
      this._sbs.sink = this._manageStoryLinkService.getChannelByName(this.activeStoryName).pipe(
        map(channel => {
          console.log(channel);
          if (channel) {
          this._manageStoryLinkService.setCurrentChannel(channel)
          console.log(channel)
          this.storyHasBeenSaved = true
          }
          else {
           // subscribe to changes in channelToSubmit in the service
           const defaultChannel = this._manageStoryLinkService.getDefaultChannel()
           console.log(defaultChannel)
           this._manageStoryLinkService.setCurrentChannel(defaultChannel);
          }
          this.isPublished = !!channel;   
        })
      ).subscribe();
    });
    console.log(this.currentChannel)

  }





private _storyExistsInChannel(channel: CommunicationChannel) {
  return this._manageStoryLinkService.getSingleStoryInChannel(channel).pipe(map(channels => !!channels.length));
}
  /**
  * Called when the portal component is rendered. Passes formGroup as an input to newly rendered Block Component
  * @param ref represents a component created by a Component factory.
  */
  onBlockComponentRendering(ref: any) {
    ref = ref as ComponentRef<any>
    ref.instance['form'] = this.activeBlockForm
    ref.instance['title'] = this.activeBlockTitle
  }

  /**  Detach and close Block Edit form */
  onClose() {
    this.activeComponent?.detach()
    this.opened = false;
  }

  onFrameViewLoaded(frame: StoryEditorFrame) {
    this.frame = frame;

    // After both frame AND data are loaded (hence the subscribe), draw frame blocks on the frame.
    this._sbs.sink =
      this.loading.pipe(filter(loading => !loading))
        .subscribe(() => {
          this.frame.init(this.state);
          this.setFrameZoom();
        }
        );

    this._cd.detectChanges();
  }

  setFrameZoom() {
    this.frameElement = document.getElementById('editor-frame')!;
    this.frameZoomInstance = newInstance({
      container: this.frameElement
    })
    this.zoom(this.frameZoom);
  }
  setZoomByPinch(value:number){
this.frameZoom=value
this.zoom(this.frameZoom)
  }

  increaseFrameZoom() {
    if (this.zoomLevel.value <= 100) this.zoom(this.frameZoom += 0.03);
  }

  decreaseFrameZoom() {
    if (this.zoomLevel.value > 25) this.zoom(this.frameZoom -= 0.03);
  }

  zoom(frameZoom: number) {
    this.frameElement.style.transform = `scale(${frameZoom})`;
    this.frame.jsPlumbInstance.setZoom(frameZoom);
    this.zoomLevel.setValue(Math.round(frameZoom / 1 * 100));
  }

  zoomChanged(event: any) {
    let z = event.target.value / 100;
    this.zoomLevel.setValue(z);
    this.zoom(z);
  }

  /** Save the changes made in the data model. */
  save() {
    this.stateSaved = false;

    let updatedState = this.state;
    updatedState.blocks = [...this.frame.blocksArray.value];

    //TODO: compare old state connections to updated connections
    // from getConnections()
    // find a jsPlumb types library to replace any with strict type
    let connections = this.frame.getJsPlumbConnections as any[];

    // remove duplicate jsplumb connections
    this.state.connections = connections.filter((con) => !con.targetId.includes('jsPlumb'));

    this._editorStateService.persist(this.state)
        .subscribe((success) => {
          if (success) {
            this.stateSaved = true;
            this.opened = false;
            this.storyHasBeenSaved = true;
          }
        });
  }

  addToChannel() {
    if (this.storyHasBeenSaved){
    this.save()
    }
    this._dialog.open(AddBotToChannelModal, {
      width: '550px'
    })

  }

  ngOnDestroy() {
    this._editorStateService.flush();
    this._sbs.unsubscribe();
  }
}
