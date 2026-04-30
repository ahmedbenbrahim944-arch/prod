import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScreenSaver1Component } from './screen-saver1.component';

describe('ScreenSaver1Component', () => {
  let component: ScreenSaver1Component;
  let fixture: ComponentFixture<ScreenSaver1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenSaver1Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ScreenSaver1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
